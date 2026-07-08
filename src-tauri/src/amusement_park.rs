use serde::Serialize;
use std::cmp;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AmusementParkOfflineResult {
    pub guests_served: u32,
    pub guests_abandoned: u32,
    pub gold_earned: f64,
    pub new_queue_length: u32,
    pub time_simulated_seconds: f64,
}

/// Computes the offline progress for the Amusement Park dynamically.
/// 
/// Instead of iterating tick-by-tick (procedural chunking), we use a stochastic
/// fluid approximation of the M/G/1 queue (Poisson arrivals, General/Pareto service).
/// 
/// # Mathematical Model
/// - **Arrivals**: Sampled from a Poisson distribution over time `t`.
/// - **Service**: Sampled using a Normal approximation of the renewal process,
///   derived from the Pareto service times.
/// - **Abandonment**: Modeled as an exponential decay on the queue, representing
///   guests leaving due to the "Heat Index" (environmental friction).
#[tauri::command]
pub fn calculate_amusement_park_offline(
    elapsed_seconds: f64,
    arrival_rate: f64,          // lambda (guests per second)
    pareto_scale: f64,          // x_m (minimum service time in seconds)
    pareto_alpha: f64,          // shape parameter (must be > 2 for finite variance)
    heat_index: f64,            // impacts abandonment probability [0.0 to 1.0]
    current_queue: u32,         // people currently in line
    gold_per_guest: f64,        // gold earned per served guest
) -> AmusementParkOfflineResult {
    let mut rng = rand::rng();

    // 1. ARRIVALS: Poisson process — arrivals in time t ~ Poisson(lambda * t).
    let expected_arrivals = arrival_rate * elapsed_seconds;

    // Poisson::new requires mean > 0. Above 1000 expected arrivals switch to the
    // Normal approximation (mean = var = lambda*t) to avoid f64 -> u64 overflow
    // on very long offline windows.
    let total_arrivals = if expected_arrivals > 0.0 {
        if expected_arrivals > 1000.0 {
            use rand_distr::{Normal, Distribution};
            let normal = Normal::new(expected_arrivals, expected_arrivals.sqrt()).unwrap();
            let sample = normal.sample(&mut rng).round();
            if sample < 0.0 { 0 } else { sample as u32 }
        } else {
            use rand_distr::{Poisson as RandPoisson, Distribution};
            let rand_poisson = RandPoisson::new(expected_arrivals).unwrap();
            rand_poisson.sample(&mut rng) as u32
        }
    } else {
        0
    };

    // 2. SERVICE: renewal-process approximation. Pareto service times:
    // E[S] = alpha*scale / (alpha-1); Var[S] = scale^2*alpha / ((alpha-1)^2 (alpha-2)).
    let alpha = if pareto_alpha <= 2.0 { 2.01 } else { pareto_alpha }; // enforce finite variance
    let expected_service_time = (alpha * pareto_scale) / (alpha - 1.0);
    let service_variance = (pareto_scale.powi(2) * alpha) / ((alpha - 1.0).powi(2) * (alpha - 2.0));

    let service_rate = 1.0 / expected_service_time; // mu

    // CLT for renewal processes: renewals in t are asymptotically Normal with
    // mean t/E[S] and variance t*Var[S]/E[S]^3.
    let expected_served = elapsed_seconds * service_rate;
    let served_variance = (elapsed_seconds * service_variance) / expected_service_time.powi(3);

    let capacity_served = if expected_served > 100.0 {
        use rand_distr::{Normal, Distribution};
        let std_dev = if served_variance > 0.0 { served_variance.sqrt() } else { 1.0 };
        let normal = Normal::new(expected_served, std_dev).unwrap_or(Normal::new(expected_served, 1.0).unwrap());
        let sample = normal.sample(&mut rng).round();
        if sample < 0.0 { 0 } else { sample as u32 }
    } else {
        expected_served.round() as u32
    };

    // Served is capped by queue + arrivals (fluid-queue simplification: arrivals
    // treated as uniform over the window).
    let max_possible_guests = current_queue + total_arrivals;
    let actual_served = cmp::min(max_possible_guests, capacity_served);

    // 3. ABANDONMENT: unserved guests decay exponentially, N(t) = N(0)*e^(-gamma*t),
    // with gamma scaled by the heat index.
    let remaining_before_abandon = max_possible_guests.saturating_sub(actual_served);

    let base_abandonment_rate = 0.0001;
    let gamma = base_abandonment_rate * (1.0 + heat_index);
    let retention_ratio = (-gamma * elapsed_seconds).exp();

    let expected_retained = (remaining_before_abandon as f64 * retention_ratio).round() as u32;
    let actual_abandoned = remaining_before_abandon.saturating_sub(expected_retained);

    let new_queue_length = expected_retained;
    let gold_earned = actual_served as f64 * gold_per_guest;

    AmusementParkOfflineResult {
        guests_served: actual_served,
        guests_abandoned: actual_abandoned,
        gold_earned,
        new_queue_length,
        time_simulated_seconds: elapsed_seconds,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_amusement_park_offline_math() {
        // Scenario: 8 hours offline (28800 seconds)
        // Arrive: 1 guest per 10 seconds (lambda = 0.1) => Expect ~2880 arrivals
        // Service: Pareto scale = 5.0, alpha = 3.0 
        // -> Expected Service Time = (3 * 5) / 2 = 7.5 seconds per guest
        // -> Service Rate = 1 / 7.5 = 0.133 guests per sec => Expect ~3840 capacity
        // Therefore, we should clear the queue and all arrivals easily.
        let result = calculate_amusement_park_offline(
            28800.0, 
            0.1, 
            5.0, 
            3.0, 
            0.5, 
            100, 
            10.0
        );

        // We expect served to be roughly arrivals + initial queue (since capacity > arrivals)
        // 2880 + 100 = 2980. With stochastic noise, maybe 2850-3100.
        assert!(result.guests_served > 2700);
        assert!(result.new_queue_length < 50); // Queue should be mostly empty due to high capacity
        
        // Scenario 2: Overwhelmed queue (lambda = 0.5, capacity = 0.133)
        // Arrivals ~ 14,400. Capacity ~ 3840.
        let result_overwhelmed = calculate_amusement_park_offline(
            28800.0, 
            0.5, 
            5.0, 
            3.0, 
            0.5, 
            100, 
            10.0
        );

        assert!(result_overwhelmed.guests_served > 3500 && result_overwhelmed.guests_served < 4200);
        // Abandonment will be very high because of the 8 hour wait and high heat index friction
        assert!(result_overwhelmed.guests_abandoned > 5000);
    }
}
