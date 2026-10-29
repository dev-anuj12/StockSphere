import * as productService from '../services/productService.js';
import { createProductSchema, updateProductSchema } from '../validators/productValidator.js';

export async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'created_at',
      order = 'DESC',
      search = '',
      categoryId,
      supplierId,
      stockStatus,
      status = 'active',
    } = req.query;

    const result = await productService.listProducts({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      order,
      search,
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      stockStatus: stockStatus || null,
      status: status === 'all' ? null : status,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const validated = createProductSchema.parse(req.body);
    const product = await productService.createProduct(validated, req.user.id);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const validated = updateProductSchema.parse(req.body);
    const updated = await productService.updateProduct(req.params.id, validated, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await productService.deleteOrArchiveProduct(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function autocomplete(req, res, next) {
  try {
    const q = req.query.q || '';
    const results = await productService.searchAutocomplete(q);
    res.status(200).json({ data: results });
  } catch (err) {
    next(err);
  }
}
