const WinningInvoice = require('../models/WinningInvoice');
const Store = require('../models/Store');
const User = require('../models/User');
const { getVietnamDayRange } = require('../utils/dateUtils');
const mongoose = require('mongoose');

// GET /api/superadmin/system-prize-statistics?date=YYYY-MM-DD
// Get prize statistics grouped by admin (sum of all stores)
const getSuperAdminPrizeStatistics = async (req, res) => {
    try {
        const { date } = req.query;
        const superAdminId = req.user.id;

        if (!date) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số date' });
        }

        // Get all admins under this superadmin
        const admins = await User.find({
            role: 'admin',
            parentId: new mongoose.Types.ObjectId(superAdminId)
        }).select('_id name username');

        const { startOfDay, endOfDay } = getVietnamDayRange(date);
        const dateFilter = {
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        };

        const results = [];

        for (const admin of admins) {
            // Get all stores for this admin
            const stores = await Store.find({ adminId: admin._id });
            const storeIds = stores.map(s => s._id);

            // Get all winning invoices for this admin's stores
            const winningInvoices = await WinningInvoice.find({
                storeId: { $in: storeIds },
                ...dateFilter
            });

            // Calculate total prize amount
            const totalPrizeAmount = winningInvoices.reduce((sum, invoice) => {
                return sum + (invoice.totalPrizeAmount || 0);
            }, 0);

            results.push({
                adminId: admin._id.toString(),
                adminName: admin.name || admin.username,
                totalPrizeAmount: totalPrizeAmount,
                invoiceCount: winningInvoices.length
            });
        }

        res.json({
            success: true,
            message: 'Lấy thống kê thưởng thành công',
            admins: results
        });

    } catch (error) {
        console.error('❌ Error getting superadmin prize statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê thưởng',
            error: error.message
        });
    }
};

// GET /api/superadmin/system-prize-statistics/stores?adminId=xxx&date=YYYY-MM-DD
// Get prize statistics for stores of a specific admin
const getSuperAdminPrizeStatisticsByStores = async (req, res) => {
    try {
        const { adminId, date } = req.query;
        const superAdminId = req.user.id;

        if (!adminId || !date) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số adminId hoặc date' });
        }

        // Verify the admin belongs to this superadmin
        const admin = await User.findOne({
            _id: adminId,
            role: 'admin',
            parentId: new mongoose.Types.ObjectId(superAdminId)
        });

        if (!admin) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập admin này' });
        }

        // Get all stores for this admin
        const stores = await Store.find({ adminId: adminId });

        const { startOfDay, endOfDay } = getVietnamDayRange(date);
        const dateFilter = {
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        };

        const results = [];

        for (const store of stores) {
            // Get winning invoices for this store
            const winningInvoices = await WinningInvoice.find({
                storeId: store._id,
                ...dateFilter
            });

            // Calculate total prize amount
            const totalPrizeAmount = winningInvoices.reduce((sum, invoice) => {
                return sum + (invoice.totalPrizeAmount || 0);
            }, 0);

            results.push({
                storeId: store._id.toString(),
                storeName: store.name,
                totalPrizeAmount: totalPrizeAmount,
                invoiceCount: winningInvoices.length
            });
        }

        res.json({
            success: true,
            message: 'Lấy thống kê thưởng theo cửa hàng thành công',
            stores: results
        });

    } catch (error) {
        console.error('❌ Error getting superadmin prize statistics by stores:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê thưởng theo cửa hàng',
            error: error.message
        });
    }
};

module.exports = {
    getSuperAdminPrizeStatistics,
    getSuperAdminPrizeStatisticsByStores
};
