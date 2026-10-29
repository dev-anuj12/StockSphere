import * as dashboardService from '../services/dashboardService.js';

export async function getStats(req, res, next) {
  try {
    const stats = await dashboardService.getStats(req.user);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

export async function getRecentMovements(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || 8, 10);
    const movements = await dashboardService.getRecentMovements(req.user, limit);
    res.status(200).json({ data: movements });
  } catch (err) {
    next(err);
  }
}

export async function getLowStock(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || 10, 10);
    const lowStock = await dashboardService.getLowStockAlerts(req.user, limit);
    res.status(200).json({ data: lowStock });
  } catch (err) {
    next(err);
  }
}

export async function getCharts(req, res, next) {
  try {
    const charts = await dashboardService.getDashboardCharts(req.user);
    res.status(200).json(charts);
  } catch (err) {
    next(err);
  }
}
