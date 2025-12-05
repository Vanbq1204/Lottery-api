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
    deaA: {},
    '3s': {},
    '4s': {},
    grouped: { tong: {}, dau: {}, dit: {}, daua: {}, dita: {}, kep: {}, bo: {} },
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
      } else if (betType === 'deaa') {
        const nums = numbersStr.split(/[\,\s]+/).filter(Boolean);
        nums.forEach(n => {
          const key = n.padStart(2, '0');
          stats.deaA[key] = (stats.deaA[key] || 0) + amount;
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
      } else if (['tong', 'dau', 'dit', 'daua', 'dita', 'kep'].includes(betType)) {
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

  const labels = Object.assign({
    lo: 'Lo',
    twoS: 'De',
    deaA: 'De A',
    threeS: 'Bc',
    fourS: '4s',
    tong: 'De Tong',
    dau: 'De Dau',
    dit: 'De Dit',
    dauA: 'De Dau A',
    ditA: 'De Dit A',
    kep: 'Kep',
    boPrefix: 'Bo',
    xien2: 'Xien2',
    xien3: 'Xien3',
    xien4: 'Xien4',
    xq3: 'xq3',
    xq4: 'xq4',
    xiennhay: 'Xiennhay'
  }, options.labels || {});

  const groupLine = (label, map) => {
    const byAmount = new Map();
    Object.entries(map || {}).forEach(([k, v]) => {
      let a = parseInt(v) || 0; if (a <= 0) return;
      // áp dụng hệ số gửi đi cho tất cả nhóm ngoại trừ lô
      a = Math.round(a * multiplier);
      if (!byAmount.has(a)) byAmount.set(a, []);
      byAmount.get(a).push(k);
    });
    const parts = Array.from(byAmount.keys()).sort((a, b) => b - a).map(a => {
      const items = byAmount.get(a).sort();
      return `${items.join(',')} x ${a}n`;
    });
    // Trả về chuỗi rỗng nếu không có dữ liệu
    if (parts.length === 0) return '';
    return `${label}: ${parts.join(', ')}`;
  };

  const groupLines = (label, map) => {
    const byAmount = new Map();
    Object.entries(map || {}).forEach(([k, v]) => {
      let a = parseInt(v) || 0; if (a <= 0) return;
      a = Math.round(a * multiplier);
      if (!byAmount.has(a)) byAmount.set(a, []);
      byAmount.get(a).push(k);
    });
    if (byAmount.size === 0) {
      return '';
    }
    const parts = Array.from(byAmount.keys()).sort((a, b) => b - a).map(a => {
      const items = byAmount.get(a).sort();
      return `${label} : ${items.join(',')} x ${a}n`;
    });
    return parts.join('\n');
  };

  const removeAccents = (s) => {
    if (!s) return s;
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const groupLinesNoAccent = (label, map) => {
    const byAmount = new Map();
    Object.entries(map || {}).forEach(([k, v]) => {
      let a = parseInt(v) || 0; if (a <= 0) return;
      a = Math.round(a * multiplier);
      if (!byAmount.has(a)) byAmount.set(a, []);
      byAmount.get(a).push(removeAccents(k));
    });
    const parts = Array.from(byAmount.keys()).sort((a, b) => b - a).map(a => {
      const items = byAmount.get(a).map(x => removeAccents(x)).sort();
      return `${label} : ${items.join(',')} x ${a}n`;
    });
    return parts.join('\n');
  };

  // Lô
  const lotoGroups = new Map();
  Object.entries(stats.loto || {}).forEach(([num, pt]) => {
    const p = parseInt(pt) || 0; if (p <= 0) return;
    if (!lotoGroups.has(p)) lotoGroups.set(p, []);
    lotoGroups.get(p).push(num);
  });
  const lotoMsg = lotoGroups.size === 0
    ? ''
    : `${labels.lo}: ${Array.from(lotoGroups.keys()).sort((a, b) => b - a).map(p => {
      const nums = lotoGroups.get(p).sort((x, y) => parseInt(x) - parseInt(y));
      return `${nums.join(',')}x${p}đ`;
    }).join(', ')}`;

  const twoSMsg = groupLine(labels.twoS, stats['2s']);
  const deAMsg = groupLine(labels.deaA, stats.deaA);
  const threeSMsg = groupLine(labels.threeS, stats['3s']);
  const fourSMsg = groupLine(labels.fourS, stats['4s']);

  const tongMsg = groupLines(labels.tong, stats.grouped.tong);
  const dauMsg = groupLines(labels.dau, stats.grouped.dau);
  const ditMsg = groupLines(labels.dit, stats.grouped.dit);
  const kepMsg = (() => {
    const map = stats.grouped.kep || {};
    const totals = new Map();
    Object.entries(map).forEach(([k, v]) => {
      let a = parseInt(v) || 0; if (a <= 0) return;
      a = Math.round(a * multiplier);
      const item = removeAccents(String(k)).toLowerCase().trim();
      totals.set(item, (totals.get(item) || 0) + a);
    });
    const label = removeAccents(String(labels.kep || 'Kep')).toLowerCase();
    if (totals.size === 0) {
      return '';
    }
    const lines = Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([item, amt]) => `${label} ${item} x ${amt}n`);
    return lines.join('\n');
  })();
  // Tách BO: số (00-99) gộp theo mức tiền, và tên đặc biệt tách dòng riêng
  const boMap = stats.grouped.bo || {};
  const numericBo = {};
  const specialBoLines = [];
  const getBoAlias = (name) => {
    const n = String(name).toLowerCase();
    const base = (x) => `De cham ${x}`;
    switch (n) {
      case 'chamkhong': return base('0');
      case 'chammot': return base('1');
      case 'chamhai': return base('2');
      case 'chamba': return base('3');
      case 'chambon': return base('4');
      case 'chamnam': return base('5');
      case 'chamsau': return base('6');
      case 'chambay': return base('7');
      case 'chamtam': return base('8');
      case 'chamchin': return base('9');
      case 'chanle': return 'De chanle';
      case 'lechan': return 'De lechan';
      case 'lele': return 'De lele';
      case 'chanchan': return 'De chanchan';
      default: return null;
    }
  };
  Object.entries(boMap).forEach(([key, val]) => {
    const alias = getBoAlias(key);
    const amount = Math.round((parseInt(val) || 0) * multiplier);
    if (!amount) return;
    const isNumericTwo = /^\d{2}$/.test(String(key));
    if (alias) {
      specialBoLines.push(`${alias} x ${amount}n`);
    } else if (!isNumericTwo) {
      specialBoLines.push(`De ${removeAccents(String(key))} x ${amount}n`);
    } else {
      numericBo[key] = (numericBo[key] || 0) + amount;
    }
  });
  // numericBo hiện là số tiền đã scale, groupLines cũng scale lại nên cần bypass scale lần 2
  const deBoMsg = (() => {
    // Tạo lại map với giá trị chưa scale để dùng groupLines? Hoặc viết groupLinesNoScale.
    // Viết nhanh một phiên bản không nhân hệ số nữa.
    const byAmount = new Map();
    Object.entries(numericBo).forEach(([k, scaledAmount]) => {
      const a = scaledAmount;
      if (a <= 0) return;
      if (!byAmount.has(a)) byAmount.set(a, []);
      byAmount.get(a).push(k);
    });
    const parts = Array.from(byAmount.keys()).sort((a, b) => b - a).map(a => {
      const items = byAmount.get(a).sort();
      return `${labels.boPrefix} : ${items.join(',')} x ${a}n`;
    });
    return parts.join('\n');
  })();
  const boMsg = [deBoMsg, ...specialBoLines.sort()].filter(s => s && s.length > 0).join('\n');

  // Xiên: tách theo độ dài (2/3/4)
  const groupXiByLen = (label, map, len) => {
    const filtered = {};
    Object.entries(map || {}).forEach(([combo, amt]) => {
      const isNhay = combo.includes('xiên nháy');
      if (isNhay) return; // loại xiên nháy khỏi nhóm thường
      const core = combo.split(' ')[0]; // bỏ nhãn nếu có
      const parts = core.split('-').filter(Boolean);
      if (parts.length === len) {
        filtered[combo] = amt;
      }
    });
    return groupLine(label, filtered);
  };

  const groupXiNhay = (label, map) => {
    const filtered = {};
    Object.entries(map || {}).forEach(([combo, amt]) => {
      if (combo.includes('xiên nháy')) {
        // bỏ nhãn để hiển thị gọn
        const core = combo.split(' ')[0];
        filtered[core] = amt;
      }
    });
    if (Object.keys(filtered).length === 0) return '';
    return groupLine(label, filtered);
  };
  const x2Msg = groupXiByLen(labels.xien2, stats.xien, 2);
  const x3Msg = groupXiByLen(labels.xien3, stats.xien, 3);
  const x4Msg = groupXiByLen(labels.xien4, stats.xien, 4);

  // Xiên quay: tách 3/4
  const groupXqByLen = (label, map, len) => {
    const filtered = {};
    Object.entries(map || {}).forEach(([combo, amt]) => {
      const parts = combo.split('-').filter(Boolean);
      if (parts.length === len) {
        filtered[combo] = amt;
      }
    });
    return groupLine(label, filtered);
  };
  const xq3Msg = groupXqByLen(labels.xq3, stats.xienquay, 3);
  const xq4Msg = groupXqByLen(labels.xq4, stats.xienquay, 4);
  const xienNhayMsg = groupXiNhay(labels.xiennhay, stats.xien);

  // Kiểm tra xem có dữ liệu cược nào không
  const dauAMsg = groupLines(labels.dauA, stats.grouped.daua);
  const ditAMsg = groupLines(labels.ditA, stats.grouped.dita);

  const hasAnyData = lotoMsg || twoSMsg || deAMsg || threeSMsg || fourSMsg || tongMsg ||
    dauMsg || ditMsg || dauAMsg || ditAMsg || kepMsg || boMsg || x2Msg || x3Msg ||
    x4Msg || xq3Msg || xq4Msg || xienNhayMsg;

  // Nếu không có dữ liệu gì, trả về message đặc biệt
  if (!hasAnyData) {
    return {
      loto: 'Không có cược trong thời gian này',
      twoS: '',
      deaA: '',
      threeS: '',
      fourS: '',
      tong: '',
      dau: '',
      dit: '',
      dauA: '',
      ditA: '',
      kep: '',
      bo: '',
      xien2: '',
      xien3: '',
      xien4: '',
      xienq3: '',
      xienq4: '',
      xiennhay: ''
    };
  }

  return {
    loto: lotoMsg,
    twoS: twoSMsg,
    deaA: deAMsg,
    threeS: threeSMsg,
    fourS: fourSMsg,
    tong: tongMsg,
    dau: dauMsg,
    dit: ditMsg,
    dauA: dauAMsg,
    ditA: ditAMsg,
    kep: kepMsg,
    bo: boMsg,
    xien2: x2Msg,
    xien3: x3Msg,
    xien4: x4Msg,
    xienq3: xq3Msg,
    xienq4: xq4Msg,
    xiennhay: xienNhayMsg
  };
};

// POST /api/admin/message-exports/export
const exportMessages = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { date, time, multiplier, format } = req.body; // date: YYYY-MM-DD, time: HH:MM optional, multiplier optional, format optional
    const { startOfDay } = getVietnamDayRange(date);
    const endTime = parseVietnamEndTime(date, time);

    // Lấy snapshot gần nhất trong ngày
    const last = await MessageExportSnapshot.findOne({ adminId, date }).sort({ sequence: -1 });
    const startTime = last ? last.endTime : startOfDay;

    // Tính stats và dựng message
    const stats = await aggregateStatsForWindow(adminId, startTime, endTime);
    const messages = buildMessages(stats, { multiplier: typeof multiplier === 'number' ? multiplier : 1.0, labels: format });

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
    const { multiplier, format } = req.body || {};

    const snapshot = await MessageExportSnapshot.findById(snapshotId);
    if (!snapshot || snapshot.adminId.toString() !== adminId.toString()) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch sử xuất phù hợp' });
    }

    // Recompute messages for the same time window
    const stats = await aggregateStatsForWindow(adminId, snapshot.startTime, snapshot.endTime);
    const messages = buildMessages(stats, { multiplier: typeof multiplier === 'number' ? multiplier : 1.0, labels: format });

    snapshot.messages = messages;
    await snapshot.save();

    res.json({ success: true, snapshot });
  } catch (error) {
    console.error('Reexport snapshot error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xuất lại tin nhắn' });
  }
};

module.exports.reexportSnapshot = reexportSnapshot;
