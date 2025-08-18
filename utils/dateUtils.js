// Utility functions để xử lý thời gian Việt Nam (UTC+7)

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam
 * @returns {Date} Date object theo giờ Việt Nam
 */
const getVietnamTime = () => {
  const now = new Date();
  // Tạo date với timezone Việt Nam
  return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
};

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam (định dạng YYYY-MM-DD)
 * @returns {string} Ngày theo định dạng YYYY-MM-DD
 */
const getCurrentVietnamDate = () => {
  const vietnamTime = getVietnamTime();
  return vietnamTime.toISOString().split('T')[0];
};

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam (định dạng HH:MM)
 * @returns {string} Thời gian theo định dạng HH:MM
 */
const getCurrentVietnamTime = () => {
  const vietnamTime = getVietnamTime();
  const hours = vietnamTime.getHours().toString().padStart(2, '0');
  const minutes = vietnamTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam (định dạng HH:MM:SS)
 * @returns {string} Thời gian theo định dạng HH:MM:SS
 */
const getCurrentVietnamTimeWithSeconds = () => {
  const vietnamTime = getVietnamTime();
  const hours = vietnamTime.getHours().toString().padStart(2, '0');
  const minutes = vietnamTime.getMinutes().toString().padStart(2, '0');
  const seconds = vietnamTime.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Chuyển đổi Date thành thời gian Việt Nam
 * @param {Date} date - Date object cần chuyển đổi
 * @returns {Date} Date object theo giờ Việt Nam
 */
const toVietnamTime = (date) => {
  return new Date(date.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
};

/**
 * Kiểm tra xem thời gian hiện tại có trước thời gian giới hạn không
 * @param {string} cutoffTime - Thời gian giới hạn (HH:MM)
 * @returns {boolean} true nếu hiện tại < cutoffTime
 */
const isBeforeCutoffTime = (cutoffTime) => {
  const vietnamTime = getVietnamTime();
  const currentHour = vietnamTime.getHours();
  const currentMinute = vietnamTime.getMinutes();
  
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
  
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const cutoffTimeInMinutes = cutoffHour * 60 + cutoffMinute;
  
  return currentTimeInMinutes < cutoffTimeInMinutes;
};

/**
 * Format Date thành chuỗi hiển thị theo định dạng Việt Nam
 * @param {Date} date - Date object
 * @returns {string} Chuỗi ngày giờ định dạng dd/mm/yyyy hh:mm:ss
 */
const formatVietnamDateTime = (date) => {
  const vietnamTime = toVietnamTime(date);
  return vietnamTime.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Lấy ngày đầu và cuối của ngày hiện tại theo múi giờ Việt Nam
 * @param {string} dateString - Ngày theo định dạng YYYY-MM-DD (optional)
 * @returns {Object} {startOfDay, endOfDay} - Date objects
 */
const getVietnamDayRange = (dateString = null) => {
  const targetDate = dateString ? new Date(dateString + 'T00:00:00') : getVietnamTime();
  
  // Tạo thời điểm đầu ngày (00:00:00) theo múi giờ Việt Nam
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Tạo thời điểm cuối ngày (23:59:59) theo múi giờ Việt Nam  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return { startOfDay, endOfDay };
};

module.exports = {
  getVietnamTime,
  getCurrentVietnamDate,
  getCurrentVietnamTime,
  getCurrentVietnamTimeWithSeconds,
  toVietnamTime,
  isBeforeCutoffTime,
  formatVietnamDateTime,
  getVietnamDayRange
}; 