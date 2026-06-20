/**
 * aggregate-metrics.mjs — Stack-level metrics (all-time, trends, health)
 * Computes system-wide metrics independent of day/run selection
 */

export class AggregateMetrics {
  constructor(allRuns = []) {
    this.runs = allRuns
    this.compute()
  }

  compute() {
    const sorted = [...this.runs].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    this.allTimeMetrics = this._computeAllTime(sorted)
    this.trends = this._computeTrends(sorted)
    this.healthScore = this._computeHealthScore(sorted)
    this.reliability = this._computeReliability(sorted)
    this.patterns = this._computePatterns(sorted)
  }

  _computeAllTime(sorted) {
    let totalCreated = 0, totalPublished = 0, totalDeleted = 0, totalLocalized = 0, totalStepsOk = 0, totalStepsTotal = 0, totalErrors = 0
    sorted.forEach(run => {
      totalCreated += run.kpis?.created || 0
      totalPublished += run.kpis?.published || 0
      totalDeleted += run.kpis?.deleted || 0
      totalLocalized += run.kpis?.localized || 0
      totalStepsOk += run.stepsOk || 0
      totalStepsTotal += run.stepsTotal || 0
      totalErrors += run.errors?.length || 0
    })
    return {
      run_count: sorted.length,
      entries_created: totalCreated,
      entries_published: totalPublished,
      entries_deleted: totalDeleted,
      entries_localized: totalLocalized,
      steps_successful: totalStepsOk,
      steps_total: totalStepsTotal,
      total_errors: totalErrors,
      overall_success_rate: totalStepsTotal > 0 ? (totalStepsOk / totalStepsTotal) * 100 : 0,
      net_entries: totalCreated - totalDeleted,
    }
  }

  _computeTrends(sorted) {
    if (sorted.length < 2) return { direction: 'insufficient_data', data_points: sorted.length }
    const mid = Math.floor(sorted.length / 2)
    const first = sorted.slice(0, mid)
    const second = sorted.slice(mid)
    const firstRate = this._calculateSuccessRate(first)
    const secondRate = this._calculateSuccessRate(second)
    const improvement = secondRate - firstRate
    return {
      success_rate_trend: improvement > 2 ? 'improving' : improvement < -2 ? 'degrading' : 'stable',
      success_rate_change: improvement.toFixed(1),
      first_half_avg: firstRate.toFixed(1),
      second_half_avg: secondRate.toFixed(1),
    }
  }

  _computeHealthScore(sorted) {
    if (sorted.length === 0) return { score: null, status: 'no_data' }
    const recent = sorted.slice(-20)
    const successRate = this._calculateSuccessRate(recent)
    const errorRate = this._calculateErrorRate(recent)
    const allGreen = recent.filter(r => r.stepsOk === r.stepsTotal).length
    const score = (successRate * 0.6) + (Math.max(0, 20 - errorRate * 20)) + ((allGreen / recent.length) * 20)
    return {
      score: Math.round(score),
      status: score >= 80 ? 'healthy' : score >= 60 ? 'acceptable' : score >= 40 ? 'degraded' : 'critical',
      components: {
        success_rate: successRate.toFixed(1),
        error_rate: errorRate.toFixed(2),
        consistency: ((allGreen / recent.length) * 100).toFixed(0),
      },
    }
  }

  _computeReliability(sorted) {
    if (sorted.length === 0) return null
    const failures = sorted.filter(r => r.stepsOk !== r.stepsTotal)
    const successes = sorted.filter(r => r.stepsOk === r.stepsTotal)
    let currentStreak = 0, longestStreak = 0
    sorted.forEach(r => {
      if (r.stepsOk === r.stepsTotal) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak) } else currentStreak = 0
    })
    return {
      total_runs: sorted.length,
      successful_runs: successes.length,
      failed_runs: failures.length,
      success_rate: ((successes.length / sorted.length) * 100).toFixed(1),
      current_streak: currentStreak,
      longest_streak: longestStreak,
    }
  }

  _computePatterns(sorted) {
    const errors = {}
    sorted.forEach(run => run.errors?.forEach(e => { const msg = e.message || 'unknown'; errors[msg] = (errors[msg] || 0) + 1 }))
    const topErrors = Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([msg, count]) => ({ message: msg, count }))
    const avgCreated = sorted.reduce((sum, r) => sum + (r.kpis?.created || 0), 0) / (sorted.length || 1)
    const avgPublished = sorted.reduce((sum, r) => sum + (r.kpis?.published || 0), 0) / (sorted.length || 1)
    return { top_errors: topErrors, avg_created: avgCreated.toFixed(0), avg_published: avgPublished.toFixed(0) }
  }

  _calculateSuccessRate(runs) {
    if (runs.length === 0) return 0
    const rates = runs.map(r => r.stepsTotal > 0 ? (r.stepsOk / r.stepsTotal) * 100 : 0)
    return rates.reduce((a, b) => a + b, 0) / rates.length
  }

  _calculateErrorRate(runs) {
    if (runs.length === 0) return 0
    return runs.reduce((sum, r) => sum + (r.errors?.length || 0), 0) / runs.length
  }

  getReport() {
    return {
      all_time: this.allTimeMetrics,
      trends: this.trends,
      health: this.healthScore,
      reliability: this.reliability,
      patterns: this.patterns,
      computed_at: new Date().toISOString(),
    }
  }
}
