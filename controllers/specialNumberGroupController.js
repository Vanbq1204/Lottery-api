const SpecialNumberGroup = require('../models/SpecialNumberGroup');

// Parse numbers input into normalized two-digit strings
const parseTwoDigitNumbers = (input) => {
  if (!input) return [];
  const tokens = String(input)
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const normalized = tokens
    .map(n => n.padStart(2, '0'))
    .filter(n => /^\d{2}$/.test(n));
  // Deduplicate while preserving order
  const seen = new Set();
  const result = [];
  for (const n of normalized) {
    if (!seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }
  return result;
};

// GET: list special number groups for store (optionally by betType)
const listGroups = async (req, res) => {
  try {
    const { storeId } = req.user;
    const { betType = '2s' } = req.query;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy thông tin cửa hàng' });
    }

    const groups = await SpecialNumberGroup.find({ storeId, betType, isActive: true })
      .sort({ name: 1, updatedAt: -1 });

    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('List special groups error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tải bộ số đặc biệt' });
  }
};

// Helper: reserved BO names (fixed in code BODATA)
const RESERVED_BO_NAMES = new Set([
  // 00-99
  ...Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')),
  // Fixed named groups
  'chanle', 'lechan', 'lele', 'chanchan',
  'chamkhong', 'chammot', 'chamhai', 'chamba', 'chambon', 'chamnam', 'chamsau', 'chambay', 'chamtam', 'chamchin'
]);

// POST: create special number group
const createGroup = async (req, res) => {
  try {
    const { storeId, id: userId } = req.user;
    const { name, numbers, betType = '2s' } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy thông tin cửa hàng' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên bộ số' });
    }
    // Validate name: liền không dấu, chữ số thường
    const normalizedName = String(name).trim().toLowerCase();
    // Chỉ cho phép chữ thường a-z, KHÔNG chứa số
    if (!/^[a-z]+$/.test(normalizedName)) {
      return res.status(400).json({ success: false, message: 'Tên bộ phải viết liền, không dấu, chỉ gồm chữ a-z (không chứa số)' });
    }

    // Chặn trùng tên với bộ cố định trong hệ thống (áp dụng cho betType 'bo')
    if (betType === 'bo' && RESERVED_BO_NAMES.has(normalizedName)) {
      return res.status(409).json({ success: false, message: 'Tên bộ trùng với bộ hệ thống (BODATA). Vui lòng chọn tên khác.' });
    }

    const parsedNumbers = Array.isArray(numbers) ? numbers : parseTwoDigitNumbers(numbers);
    if (parsedNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách số không hợp lệ (yêu cầu số 2 chữ số)' });
    }
    if (parsedNumbers.length > 200) {
      return res.status(400).json({ success: false, message: 'Tối đa 200 số trong một bộ' });
    }

    const group = new SpecialNumberGroup({
      storeId,
      name: normalizedName,
      betType,
      numbers: parsedNumbers,
      createdBy: userId,
      updatedBy: userId
    });

    await group.save();
    res.json({ success: true, data: group, message: 'Đã tạo bộ số đặc biệt' });
  } catch (error) {
    console.error('Create special group error:', error);
    const isDuplicate = error.code === 11000;
    res.status(isDuplicate ? 409 : 500).json({ 
      success: false, 
      message: isDuplicate ? 'Tên bộ đã tồn tại trong cửa hàng' : 'Lỗi server khi tạo bộ số đặc biệt' 
    });
  }
};

// PUT: update special number group
const updateGroup = async (req, res) => {
  try {
    const { storeId, id: userId } = req.user;
    const { groupId } = req.params;
    const { name, numbers, isActive } = req.body;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy thông tin cửa hàng' });
    }

    const update = { updatedBy: userId };
    if (name !== undefined) {
      const newName = String(name).trim().toLowerCase();
      // Chỉ cho phép chữ thường a-z, KHÔNG chứa số
      if (!/^[a-z]+$/.test(newName)) {
        return res.status(400).json({ success: false, message: 'Tên bộ phải viết liền, không dấu, chỉ gồm chữ a-z (không chứa số)' });
      }
      update.name = newName;
      // Kiểm tra trùng tên với BODATA cho betType 'bo'
      const currentGroup = await SpecialNumberGroup.findById(groupId);
      const effectiveBetType = currentGroup?.betType || 'bo';
      if (effectiveBetType === 'bo' && RESERVED_BO_NAMES.has(newName)) {
        return res.status(409).json({ success: false, message: 'Tên bộ trùng với bộ hệ thống (BODATA). Vui lòng chọn tên khác.' });
      }
    }
    if (numbers !== undefined) {
      const parsed = Array.isArray(numbers) ? numbers : parseTwoDigitNumbers(numbers);
      if (parsed.length === 0) {
        return res.status(400).json({ success: false, message: 'Danh sách số không hợp lệ (yêu cầu số 2 chữ số)' });
      }
      if (parsed.length > 200) {
        return res.status(400).json({ success: false, message: 'Tối đa 200 số trong một bộ' });
      }
      update.numbers = parsed;
    }
    if (isActive !== undefined) update.isActive = !!isActive;

    const group = await SpecialNumberGroup.findOneAndUpdate(
      { _id: groupId, storeId },
      update,
      { new: true }
    );

    if (!group) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bộ số để cập nhật' });
    }

    res.json({ success: true, data: group, message: 'Đã cập nhật bộ số đặc biệt' });
  } catch (error) {
    console.error('Update special group error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật bộ số đặc biệt' });
  }
};

// DELETE: delete special number group
const deleteGroup = async (req, res) => {
  try {
    const { storeId } = req.user;
    const { groupId } = req.params;

    if (!storeId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy thông tin cửa hàng' });
    }

    const result = await SpecialNumberGroup.deleteOne({ _id: groupId, storeId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bộ số để xóa' });
    }

    res.json({ success: true, message: 'Đã xóa bộ số đặc biệt' });
  } catch (error) {
    console.error('Delete special group error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa bộ số đặc biệt' });
  }
};

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup
};