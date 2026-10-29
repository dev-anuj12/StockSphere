import * as categoryService from '../services/categoryService.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categoryValidator.js';

export async function list(req, res, next) {
  try {
    const categories = await categoryService.listCategories();
    res.status(200).json({ data: categories });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const validated = createCategorySchema.parse(req.body);
    const category = await categoryService.createCategory(validated, req.user.id);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const validated = updateCategorySchema.parse(req.body);
    const updated = await categoryService.updateCategory(req.params.id, validated, req.user.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
