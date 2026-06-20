/**
 * CalendarHeatmap.jsx — Interactive calendar showing runs per day with heatmap intensity
 *
 * Features:
 * - Clickable day cells
 * - Intensity based on: success rate, run count, or operations performed
 * - Tooltip showing daily stats
 * - Month/year navigation
 */

import { useState, useMemo } from 'react'
import './CalendarHeatmap.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDayKey(date) {
  return date.toISOString().split('T')[0]
}

function getColor(intensity, metric = 'count') {
  // Color scale: white → light blue → dark blue → green
  if (intensity === 0) return '#f0f0f0'
  if (intensity < 0.2) return '#e6f3ff'
  if (intensity < 0.4) return '#99d6ff'
  if (intensity < 0.6) return '#4da6ff'
  if (intensity < 0.8) return '#0073e6'
  return '#00b300' // Green for perfect
}

function getIntensity(value, max) {
  return max === 0 ? 0 : Math.min(1, value / max)
}

export default function CalendarHeatmap({ runs, onDaySelect, selectedDay }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Group runs by day
  const runsByDay = useMemo(() => {
    const grouped = {}
    runs.forEach((run) => {
      const date = new Date(run.startedAt)
      const key = getDayKey(date)
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(run)
    })
    return grouped
  }, [runs])

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    const stats = {}
    Object.entries(runsByDay).forEach(([day, dayRuns]) => {
      const stepsOk = dayRuns.reduce((sum, r) => sum + (r.stepsOk || 0), 0)
      const stepsTotal = dayRuns.reduce((sum, r) => sum + (r.stepsTotal || 0), 0)
      const created = dayRuns.reduce((sum, r) => sum + (r.kpis?.created || 0), 0)
      const errors = dayRuns.reduce((sum, r) => sum + (r.errors?.length || 0), 0)
      const successRate = stepsTotal > 0 ? stepsOk / stepsTotal : 0

      stats[day] = {
        count: dayRuns.length,
        stepsOk,
        stepsTotal,
        successRate,
        created,
        errors,
        lastRun: dayRuns[dayRuns.length - 1],
      }
    })
    return stats
  }, [runsByDay])

  // Calculate max values for color scaling
  const maxCount = Math.max(1, ...Object.values(dailyStats).map((s) => s.count))
  const maxCreated = Math.max(1, ...Object.values(dailyStats).map((s) => s.created))

  // Generate calendar grid
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startingDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))

  const cells = []
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    cells.push(null)
  }
  // Cells for each day of month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    cells.push(date)
  }

  return (
    <div className="heatmap">
      <div className="heatmap__header">
        <button className="heatmap__nav" onClick={prevMonth}>←</button>
        <h3 className="heatmap__title">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button className="heatmap__nav" onClick={nextMonth}>→</button>
      </div>

      <div className="heatmap__weekdays">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="heatmap__weekday">
            {wd}
          </div>
        ))}
      </div>

      <div className="heatmap__grid">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="heatmap__cell heatmap__cell--empty" />

          const dayKey = getDayKey(date)
          const stats = dailyStats[dayKey]
          const intensity = stats ? getIntensity(stats.count, maxCount) : 0
          const isSelected = selectedDay === dayKey

          return (
            <div
              key={dayKey}
              className={`heatmap__cell ${isSelected ? 'heatmap__cell--selected' : ''}`}
              style={{ background: getColor(intensity) }}
              onClick={() => onDaySelect(dayKey, stats)}
              title={stats ? `${stats.count} run(s) · ${stats.created} entries created` : 'No runs'}
            >
              <div className="heatmap__day">{date.getDate()}</div>
              {stats && (
                <div className="heatmap__indicator">
                  {stats.count > 0 && (
                    <span className="heatmap__count" title="Runs">
                      {stats.count}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="heatmap__legend">
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#f0f0f0' }}></span>
          <span>No runs</span>
        </div>
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#e6f3ff' }}></span>
          <span>1-2 runs</span>
        </div>
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#99d6ff' }}></span>
          <span>3-5 runs</span>
        </div>
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#4da6ff' }}></span>
          <span>6-10 runs</span>
        </div>
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#0073e6' }}></span>
          <span>10+ runs</span>
        </div>
        <div className="heatmap__legend-item">
          <span className="heatmap__swatch" style={{ background: '#00b300' }}></span>
          <span>All green ✓</span>
        </div>
      </div>
    </div>
  )
}
