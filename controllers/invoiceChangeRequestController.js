const Invoice = require('../models/Invoice');
const InvoiceChangeRequest = require('../models/InvoiceChangeRequest');
const MessageExportSnapshot = require('../models/MessageExportSnapshot');
const User = require('../models/User');

// Employee: create request to edit/delete invoice
const createRequest = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { invoiceId, requestType, reason } = req.body;
    if (!invoiceId || !requestType) {
      return res.status(400).json({ success: false, message: 'Thiếu invoiceId hoặc requestType' });
    }
    if (!['edit','delete'].includes(requestType)) {
      return res.status(400).json({ success: false, message: 'requestType không hợp lệ' });
    }

    const invoice = await Invoice.findOne({ invoiceId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Verify employee belongs to the same store
    const employee = await User.findById(employeeId);
    if (!employee || invoice.storeId.toString() !== employee.storeId.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền yêu cầu cho hóa đơn này' });
    }

    // Xác định điều kiện bắt buộc duyệt: hóa đơn nằm trong snapshot đã xuất HOẶC admin bật chính sách enforceDeleteApproval
    const lockedSnapshot = await MessageExportSnapshot.findOne({
      adminId: invoice.adminId,
      startTime: { $lte: invoice.printedAt },
      endTime: { $gte: invoice.printedAt }
    });
    const admin = await User.findById(invoice.adminId);
    const mustRequireApproval = Boolean(lockedSnapshot) || Boolean(admin?.enforceDeleteApproval);
    if (!mustRequireApproval) {
      return res.status(400).json({ success: false, message: 'Hóa đơn không cần duyệt, có thể sửa/xóa trực tiếp' });
    }

    // Avoid duplicate pending/approved requests
    const existingReq = await InvoiceChangeRequest.findOne({ invoiceId, status: { $in: ['pending','approved'] } });
    if (existingReq) {
      return res.json({ success: true, message: 'Yêu cầu đã tồn tại', request: existingReq });
    }

    const reqDoc = new InvoiceChangeRequest({
      invoiceId,
      invoiceRef: invoice._id,
      storeId: invoice.storeId,
      adminId: invoice.adminId,
      employeeId,
      requestType,
      reason: reason || ''
    });
    await reqDoc.save();

    // Emit socket event to admin room for real-time UI update
    try {
      const io = req.app.get('socketio');
      if (io) {
        const adminRoom = invoice.adminId.toString();
        io.to(adminRoom).emit('invoice_change_request', {
          message: `Yêu cầu ${requestType} hóa đơn ${invoiceId} từ nhân viên`,
          request: {
            _id: reqDoc._id,
            invoiceId: reqDoc.invoiceId,
            requestType: reqDoc.requestType,
            status: reqDoc.status,
            employeeId: { name: employee.name, username: employee.username },
            reason: reqDoc.reason,
            requestedAt: reqDoc.requestedAt
          }
        });
      }
    } catch (e) {
      // ignore socket errors
    }

    return res.json({ success: true, message: 'Đã gửi yêu cầu tới admin', request: reqDoc });
  } catch (error) {
    console.error('Create invoice change request error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tạo yêu cầu' });
  }
};

// Admin: list requests
const listRequests = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { status = 'pending' } = req.query;
    const query = { adminId };
    if (status) query.status = status;
    const requests = await InvoiceChangeRequest.find(query).sort({ requestedAt: -1 }).populate('employeeId','name username');
    return res.json({ success: true, requests });
  } catch (error) {
    console.error('List invoice change requests error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách yêu cầu' });
  }
};

// Admin: approve/reject request
const decideRequest = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { requestId } = req.params;
    const { action, note } = req.body; // action: 'approve' | 'reject'
    if (!['approve','reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Hành động không hợp lệ' });
    }
    const reqDoc = await InvoiceChangeRequest.findById(requestId);
    if (!reqDoc || reqDoc.adminId.toString() !== adminId.toString()) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    }
    reqDoc.status = action === 'approve' ? 'approved' : 'rejected';
    reqDoc.decisionNote = note || '';
    reqDoc.decidedAt = new Date();
    await reqDoc.save();
    // Emit socket events:
    try {
      const io = req.app.get('socketio');
      if (io) {
        const adminRoom = adminId.toString();
        const employeeRoom = reqDoc.employeeId.toString();
        // Notify admin to refresh list
        io.to(adminRoom).emit('invoice_change_request_decided', {
          requestId: reqDoc._id.toString(),
          status: reqDoc.status
        });
        // Notify employee with details
        io.to(employeeRoom).emit('invoice_change_request_decided', {
          invoiceId: reqDoc.invoiceId,
          requestType: reqDoc.requestType,
          status: reqDoc.status
        });
      }
    } catch (e) {}
    return res.json({ success: true, request: reqDoc });
  } catch (error) {
    console.error('Decide invoice change request error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xử lý yêu cầu' });
  }
};

module.exports = { createRequest, listRequests, decideRequest };
