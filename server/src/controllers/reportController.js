import * as reportService from '../services/reportService.js';

export async function getReport(req, res, next) {
  try {
    const {
      type = 'stock',
      format = 'json',
      dateFrom,
      dateTo,
      warehouseId,
      productId,
    } = req.query;

    const report = await reportService.generateReport({
      type,
      format,
      dateFrom,
      dateTo,
      warehouseId,
      productId,
    });

    if (report.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      return res.status(200).send(report.content);
    }

    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}
