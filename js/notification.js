let reminderMinutes = APP_CONFIG.defaultReminder;
let timers = [];
let reminderInterval = null;

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

function refreshReminders() {
    const schedule = loadSchedule();
    scheduleReminders(schedule);
}

function scheduleReminders(schedule) {
    timers.forEach(clearTimeout);
    timers = [];
    
    const now = new Date();
    schedule.forEach(course => {
        if (!course.time) return;
        // 解析时间，格式如 "周一 14:30-15:55"
        const parts = course.time.match(/周([一二三四五六日])\s*(\d{1,2}):(\d{2})/);
        if (!parts) return;
        const weekdayMap = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':0 };
        const targetWeekday = weekdayMap[parts[1]];
        const targetHour = parseInt(parts[2]);
        const targetMinute = parseInt(parts[3]);
        
        // 计算下一次该课程时间
        let targetDate = new Date(now);
        targetDate.setHours(targetHour, targetMinute, 0, 0);
        const currentWeekday = now.getDay();
        let daysDiff = targetWeekday - currentWeekday;
        if (daysDiff < 0) daysDiff += 7;
        if (daysDiff === 0 && targetDate <= now) daysDiff = 7;
        targetDate.setDate(now.getDate() + daysDiff);
        
        const timeDiff = targetDate - now - reminderMinutes * 60000;
        if (timeDiff > 0) {
            const timer = setTimeout(() => {
                Swal.fire({
                    title: '上课提醒',
                    text: `${course.name} 即将在 ${course.room} 开始，请前往导航`,
                    icon: 'info',
                    confirmButtonText: '立即导航',
                    confirmButtonColor: '#003f87'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.navigateToRoom(course.roomId);
                    }
                });
            }, timeDiff);
            timers.push(timer);
        }
    });
}

function setReminderMinutes(minutes) {
    reminderMinutes = minutes;
}

// 每分钟检查一次，动态更新提醒
function startReminderInterval() {
    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = setInterval(() => {
        refreshReminders();
    }, 60000);
}