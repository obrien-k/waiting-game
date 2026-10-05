use serde::Serialize;
use std::cmp;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GroceryLineOfflineResult {
    pub shoppers_served: u32,
    pub shoppers_abandoned: u32,
    pub gold_earned: f64,
    pub new_queue_length: u32,
    pub time_simulated_seconds: f64,
}

/// Offline progress for Waiting in Line (grocery checkout).
///
/// Stochastic fluid approximation of an M/G/1 queue rather than tick-by-tick
/// replay.
///
/// # Model
/// - **Arrivals**: Poisson over the window.
/// - **Service**: Normal approximation of the renewal process built from
///   Pareto checkout times.
/// - **Abandonment**: exponential decay on the unserved queue (shoppers who
///   give up and leave their cart).
#[tauri::command]
pub fn calculate_grocery_line_offline(
    elapsed_seconds: f64,
    arrival_rate: f64,    // lambda (shoppers per second)
    pareto_scale: f64,    // x_m (minimum checkout time in seconds)
    pareto_alpha: f64,    // shape parameter (must be > 2 for finite variance)
    current_queue: u32,   // shoppers currently in line
    gold_per_shopper: f64,
) -> GroceryLineOfflineResult {
    let mut rng = rand::rng();

    // 1. ARRIVALS: Poisson(lambda * t). Poisson::new requires mean > 0; above
    // 1000 switch to the Normal approximation to avoid f64 -> u64 overflow.
    let expected_arrivals = arrival_rate * elapsed_seconds;
    let total_arrivals = if expected_arrivals > 0.0 {
        if expected_arrivals > 1000.0 {
            use rand_distr::{Distribution, Normal};
            let normal = Normal::new(expected_arrivals, expected_arrivals.sqrt()).unwrap();
            let sample = normal.sample(&mut rng).round();
            if sample < 0.0 { 0 } else { sample as u32 }
        } else {
            use rand_distr::{Distribution, Poisson as RandPoisson};
            let rand_poisson = RandPoisson::new(expected_arrivals).unwrap();
            rand_poisson.sample(&mut rng) as u32
        }
    } else {
        0
    };

    // 2. SERVICE: E[S] = alpha*scale/(alpha-1); Var[S] = scale^2*alpha/((alpha-1)^2 (alpha-2)).
    let alpha = if pareto_alpha <= 2.0 { 2.01 } else { pareto_alpha };
    let expected_service_time = (alpha * pareto_scale) / (alpha - 1.0);
    let service_variance =
        (pareto_scale.powi(2) * alpha) / ((alpha - 1.0).powi(2) * (alpha - 2.0));
    let service_rate = 1.0 / expected_service_time;

    // Renewal CLT: count in t ~ Normal(t/E[S], t*Var[S]/E[S]^3).
    let expected_served = elapsed_seconds * service_rate;
    let served_variance = (elapsed_seconds * service_variance) / expected_service_time.powi(3);

    let capacity_served = if expected_served > 100.0 {
        use rand_distr::{Distribution, Normal};
        let std_dev = if served_variance > 0.0 { served_variance.sqrt() } else { 1.0 };
        let normal = Normal::new(expected_served, std_dev)
            .unwrap_or(Normal::new(expected_served, 1.0).unwrap());
        let sample = normal.sample(&mut rng).round();
        if sample < 0.0 { 0 } else { sample as u32 }
    } else {
        expected_served.round() as u32
    };

    let max_possible = current_queue + total_arrivals;
    let actual_served = cmp::min(max_possible, capacity_served);

    // 3. ABANDONMENT: N(t) = N(0) * e^(-gamma*t).
    let remaining = max_possible.saturating_sub(actual_served);
    let gamma = 0.0001;
    let retained = (remaining as f64 * (-gamma * elapsed_seconds).exp()).round() as u32;
    let abandoned = remaining.saturating_sub(retained);

    GroceryLineOfflineResult {
        shoppers_served: actual_served,
        shoppers_abandoned: abandoned,
        gold_earned: actual_served as f64 * gold_per_shopper,
        new_queue_length: retained,
        time_simulated_seconds: elapsed_seconds,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grocery_line_offline_math() {
        // 8h offline, lambda 0.1, E[S] = 7.5s -> capacity ~3840 > ~2880 arrivals.
        let result = calculate_grocery_line_offline(28800.0, 0.1, 5.0, 3.0, 100, 10.0);
        assert!(result.shoppers_served > 2700);
        assert!(result.new_queue_length < 50);

        // Overwhelmed: lambda 0.5 -> ~14,400 arrivals vs ~3840 capacity.
        let overwhelmed = calculate_grocery_line_offline(28800.0, 0.5, 5.0, 3.0, 100, 10.0);
        assert!(overwhelmed.shoppers_served > 3500 && overwhelmed.shoppers_served < 4200);
        // ~10.6k unserved, retention e^(-2.88) ~ 5.6% -> ~10k walk out.
        assert!(overwhelmed.shoppers_abandoned > 5000);
    }
}
