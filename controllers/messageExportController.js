const Invoice = require('../models/Invoice');
const MessageExportSnapshot = require('../models/MessageExportSnapshot');
const mongoose = require('mongoose');
const { getVietnamDayRange } = require('../utils/dateUtils');

// Helper: parse Vietnam time end
const parseVietnamEndTime = (dateStr, timeStr) => {
  if (!dateStr) return new Date();
  if (!timeStr) {
    // default to now but clamp to selected date end
    const now = new Date();
    const { startOfDay, endOfDay } = getVietnamDayRange(dateStr);
    return now < endOfDay && now > startOfDay ? now : endOfDay;
  }
  // Expect HH:MM
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
};

// Aggregate stats for admin between two times
const aggregateStatsForWindow = async (adminId, startTime, endTime) => {
  const invoices = await Invoice.find({
    adminId: new mongoose.Types.ObjectId(adminId),
    printedAt: { $gte: startTime, $lte: endTime }
  });

  const stats = {
    loto: {},
    '2s': {},
    '3s': {},
    '4s': {},
    grouped: { tong: {}, dau: {}, dit: {}, kep: {}, bo: {} },
    xien: {},
    xienquay: {}
  };

  invoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const betType = (item.betType || '').toLowerCase();
      const numbersStr = item.numbers || '';
      const totalAmount = parseInt(item.totalAmount || 0) || 0; // đơn vị n
      const amount = parseInt(item.amount || 0) || 0; // đơn vị n
      const points = parseInt(item.points || 0) || 0; // điểm

      if (betType === 'loto') {
        const nums = numbersStr.split(/[,\s]+/).filter(Boolean);
        nums.forEach(n => {
          const key = n.padStart(2, '0');
          stats.loto[key] = (stats.loto[key] || 0) + points;
        });
      } else if (betType === '2s') {
        const nums = numbersStr.split(/[,\s]+/).filter(Boolean);
        nums.forEach(n => {
          const key = n.padStart(2, '0');
          stats['2s'][key] = (stats['2s'][key] || 0) + amount;
        });
      } else if (betType === '3s') {
        const nums = numbersStr.split(/[,\s]+/).filter(Boolean);
        const per = nums.length > 0 ? Math.floor(totalAmount / nums.length) : 0;
        nums.forEach(n => {
          const key = n.trim().padStart(3, '0');
          stats['3s'][key] = (stats['3s'][key] || 0) + (amount || per);
        });
      } else if (betType === '4s') {
        const nums = numbersStr.split(/[,\s]+/).filter(Boolean);
        const per = nums.length > 0 ? Math.floor(totalAmount / nums.length) : 0;
        nums.forEach(n => {
          const key = n.trim().padStart(4, '0');
          stats['4s'][key] = (stats['4s'][key] || 0) + (amount || per);
        });
      } else if (['tong', 'dau', 'dit', 'kep'].includes(betType)) {
        const key = numbersStr.trim();
        if (!key) return;
        stats.grouped[betType][key] = (stats.grouped[betType][key] || 0) + amount;
      } else if (betType === 'bo') {
        const nums = numbersStr.split(/[,\s]+/).filter(Boolean);
        const per = nums.length > 0 ? Math.floor(totalAmount / nums.length) : 0;
        nums.forEach(n => {
          const key = n.padStart(2, '0');
          stats.grouped.bo[key] = (stats.grouped.bo[key] || 0) + (amount || per);
        });
      } else if (betType.includes('xien') && !betType.includes('quay')) {
        const combos = numbersStr.split(',').map(c => c.trim()).filter(Boolean);
        const perCombo = combos.length > 0 ? Math.floor(totalAmount / combos.length) : 0;
        combos.forEach(combo => {
          const numbers = combo.split(/[\s\-]+/).filter(Boolean);
          const baseKey = numbers.join('-');
          const key = item.isXienNhay ? `${baseKey} (xiên nháy)` : baseKey;
          stats.xien[key] = (stats.xien[key] || 0) + (amount || perCombo);
        });
      } else if (betType.includes('xienquay')) {
        const combos = numbersStr.split(',').map(c => c.trim()).filter(Boolean);
        const per = amount || (combos.length > 0 ? Math.floor(totalAmount / combos.length) : 0);
        combos.forEach(combo => {
          const numbers = combo.split(/[\s\-]+/).filter(Boolean);
          const key = numbers.join('-');
          stats.xienquay[key] = (stats.xienquay[key] || 0) + per;
        });
      }
    });
  });

  return stats;
};

// Build message strings from stats
const buildMessages = (stats, options = {}) => {
  const multiplierInput = typeof options.multiplier === 'number' ? options.multiplier : 1;
  const multiplier = Math.max(1, multiplierInput); // tối thiểu 1

  const groupLine = (label, map) => {
    const byAmount = new Map();
    Object.entries(map || {}).forEach(([k, v]) => {
      let a = parseInt(v) || 0; if (a <= 0) return;
      // áp dụng hệ số gửi đi cho tất cả nhóm ngoại trừ lô
      a = Math.round(a * multiplier);
      if (!byAmount.has(a)) byAmount.set(a, []);
      byAmount.get(a).push(k);
    });
    const parts = Array.from(byAmount.keys()).sort((a,b)=>b-a).map(a => {
      const items = byAmount.get(a).sort();
      return `${items.join(',')}x${a}n`;
    });
    return `${label}: ${parts.join(', ')}`;
  };

  // Lô
  const lotoGroups = new Map();
  Object.entries(stats.loto || {}).forEach(([num, pt]) => {
    const p = parseInt(pt) || 0; if (p <= 0) return;
    if (!lotoGroups.has(p)) lotoGroups.set(p, []);
    lotoGroups.get(p).push(num);
  });
  const lotoMsg = `L: ${Array.from(lotoGroups.keys()).sort((a,b)=>b-a).map(p=>{
    const nums = lotoGroups.get(p).sort((x,y)=>parseInt(x)-parseInt(y));
    return `${nums.join(',')}x${p}đ`;
  }).join(', ')}`;

  const twoSMsg = groupLine('Đ', stats['2s']);
  const threeSMsg = groupLine('3s', stats['3s']);
  const fourSMsg = groupLine('4s', stats['4s']);
  const tongMsg = groupLine('Tổng', stats.grouped.tong);
  const dauMsg = groupLine('Đầu', stats.grouped.dau);
  const ditMsg = groupLine('Đít', stats.grouped.dit);
  const kepMsg = groupLine('Kép', stats.grouped.kep);
  const boMsg = groupLine('Bộ', stats.grouped.bo);

  const xMsg = groupLine('X', stats.xien);
  const xqMsg = groupLine('Xquay', stats.xienquay);

  return {
    loto: lotoMsg,
    twoS: twoSMsg,
    threeS: threeSMsg,
    fourS: fourSMsg,
    tong: tongMsg,
    dau: dauMsg,
    dit: ditMsg,
    kep: kepMsg,
    bo: boMsg,
    xien: xMsg,
    xienquay: xqMsg
  };
};

// POST /api/admin/message-exports/export
const exportMessages = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { date, time, multiplier } = req.body; // date: YYYY-MM-DD, time: HH:MM optional, multiplier optional
    const { startOfDay } = getVietnamDayRange(date);
    const endTime = parseVietnamEndTime(date, time);

    // Lấy snapshot gần nhất trong ngày
    const last = await MessageExportSnapshot.findOne({ adminId, date }).sort({ sequence: -1 });
    const startTime = last ? last.endTime : startOfDay;

    // Tính stats và dựng message
    const stats = await aggregateStatsForWindow(adminId, startTime, endTime);
    const messages = buildMessages(stats, { multiplier: typeof multiplier === 'number' ? multiplier : 1.0 });

    // Tạo snapshot mới
    const seq = (last?.sequence || 0) + 1;
    const snapshot = new MessageExportSnapshot({
      adminId,
      date,
      sequence: seq,
      startTime,
      endTime,
      messages
    });
    await snapshot.save();

    res.json({ success: true, snapshot });
  } catch (error) {
    console.error('Export messages error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xuất tin nhắn' });
  }
};

// GET /api/admin/message-exports/history?date=YYYY-MM-DD
const getExportHistory = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { date } = req.query;
    const history = await MessageExportSnapshot.find({ adminId, date }).sort({ sequence: 1 });
    res.json({ success: true, snapshots: history });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử xuất tin nhắn' });
  }
};

module.exports = {
  exportMessages,
  getExportHistory
};

// PUT /api/admin/message-exports/reexport/:snapshotId
const reexportSnapshot = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { snapshotId } = req.params;
    const { multiplier } = req.body || {};

    const snapshot = await MessageExportSnapshot.findById(snapshotId);
    if (!snapshot || snapshot.adminId.toString() !== adminId.toString()) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch sử xuất phù hợp' });
    }

    // Recompute messages for the same time window
    const stats = await aggregateStatsForWindow(adminId, snapshot.startTime, snapshot.endTime);
    const messages = buildMessages(stats, { multiplier: typeof multiplier === 'number' ? multiplier : 1.0 });

    snapshot.messages = messages;
    await snapshot.save();

    res.json({ success: true, snapshot });
  } catch (error) {
    console.error('Reexport snapshot error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xuất lại tin nhắn' });
  }
};

module.exports.reexportSnapshot = reexportSnapshot;