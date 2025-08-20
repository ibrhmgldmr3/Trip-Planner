// durations: NxN saniye matrisi, 0..n-1
export function nearestNeighborOrder(durations: number[][], start = 0) {
  const n = durations.length;
  const used = Array(n).fill(false);
  let current = start;
  const order = [current];
  used[current] = true;

  for (let step = 1; step < n; step++) {
    let best = -1, bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (!used[j] && durations[current][j] < bestCost) {
        best = j; bestCost = durations[current][j];
      }
    }
    current = best;
    used[current] = true;
    order.push(current);
  }
  return order; // örn: [0,3,1,2,...]
}
// durations: NxN saniye matrisi, 0..n-1