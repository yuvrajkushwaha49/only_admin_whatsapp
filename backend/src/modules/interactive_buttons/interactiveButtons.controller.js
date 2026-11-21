import * as buttonsService from './interactiveButtons.service.js';
import logger from '../../utils/logger.js';

export async function list(req, res, next) {
  try {
    const businessId = req.businessId;
    const { search, type, category, status } = req.query;

    const data = await buttonsService.getButtons(businessId, {
      search,
      type,
      category,
      status
    });

    res.json({
      success: true,
      data
    });
  } catch (err) {
    logger.error('[InteractiveButtons] list error:', err);
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const button = await buttonsService.getButtonById(businessId, id);
    if (!button) {
      return res.status(404).json({
        success: false,
        error: { message: 'Interactive button not found' }
      });
    }

    res.json({
      success: true,
      data: button
    });
  } catch (err) {
    logger.error('[InteractiveButtons] getById error:', err);
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const businessId = req.businessId;
    const userId = req.user?.id;

    const button = await buttonsService.createButton(businessId, userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Interactive button preset created successfully',
      data: button
    });
  } catch (err) {
    logger.error('[InteractiveButtons] create error:', err);
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to create interactive button' }
    });
  }
}

export async function update(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const button = await buttonsService.updateButton(businessId, id, req.body);

    res.json({
      success: true,
      message: 'Interactive button preset updated successfully',
      data: button
    });
  } catch (err) {
    logger.error('[InteractiveButtons] update error:', err);
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to update interactive button' }
    });
  }
}

export async function remove(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    await buttonsService.deleteButton(businessId, id);

    res.json({
      success: true,
      message: 'Interactive button preset deleted successfully'
    });
  } catch (err) {
    logger.error('[InteractiveButtons] remove error:', err);
    next(err);
  }
}
