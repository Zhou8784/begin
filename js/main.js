let currentSchedule = [];
let activeTypes = ['多媒体教室', '办公室', '卫生间', '饮水机', '打印机', '楼梯间', '功能性公用自习室', '仓库', '垃圾桶'];

// 选点状态
let startPoint = null;
let endPoint = null;
window.pickingMode = null;

// ========== 默认课表 ==========
const DEFAULT_SCHEDULE = [
    { id: 'default_1', name: '大学语文', room: '3栋2楼203', roomId: '3-203', time: '周一 14:30-15:55' },
    { id: 'default_2', name: '大学生创新创业基础', room: '1栋2楼201', roomId: '1-201', time: '周一 16:15-17:40' },
    { id: 'default_3', name: '高等数学', room: '1栋1楼102', roomId: '1-102', time: '周二 09:45-11:55' },
    { id: 'default_4', name: '离散数学', room: '1栋1楼101', roomId: '1-101', time: '周三 08:00-09:25' },
    { id: 'default_5', name: '思想道德与法治', room: '3栋1楼104', roomId: '3-104', time: '周三 09:45-11:10' },
    { id: 'default_6', name: '离散数学', room: '1栋1楼101', roomId: '1-101', time: '周三 14:30-15:55' },
    { id: 'default_7', name: 'Python程序设计基础', room: '1栋2楼203', roomId: '1-203', time: '周三 16:15-17:40' },
    { id: 'default_8', name: 'Python程序设计基础', room: '1栋2楼203', roomId: '1-203', time: '周四 08:00-09:25' },
    { id: 'default_9', name: '高等数学', room: '3栋2楼203', roomId: '3-203', time: '周四 09:45-11:10' },
    { id: 'default_10', name: '大学英语', room: '2栋1楼103', roomId: '2-103', time: '周五 14:30-16:55' },
    { id: 'default_11', name: '思想道德与法治', room: '3栋1楼102', roomId: '3-102', time: '周六 14:30-17:40' }
];

window.onload = () => {
    initMap();
    
    const stored = loadSchedule();
    if (stored && stored.length > 0) {
        currentSchedule = stored;
    } else {
        currentSchedule = [...DEFAULT_SCHEDULE];
        saveSchedule(currentSchedule);
    }
    
    renderScheduleList();
    bindEvents();
    
    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            if (!localStorage.getItem('guide_shown')) {
                document.getElementById('guide-modal').style.display = 'flex';
                localStorage.setItem('guide_shown', 'true');
            }
        }, 500);
    }, 800);
    
    requestNotificationPermission();
    // 启动实时提醒轮询
    startReminderInterval();
};

window.setPickedPoint = (room) => {
    if (window.pickingMode === 'start') {
        startPoint = room;
        document.getElementById('start-point-label').textContent = room.name;
        document.getElementById('pick-start-btn').classList.remove('active');
    } else if (window.pickingMode === 'end') {
        endPoint = room;
        document.getElementById('end-point-label').textContent = room.name;
        document.getElementById('pick-end-btn').classList.remove('active');
    }
    window.pickingMode = null;
    map.getContainer().style.cursor = '';
    
    document.getElementById('start-navigation-btn').disabled = !(startPoint && endPoint);
};

function bindEvents() {
    const safeGet = (id) => document.getElementById(id);
    
    // 导入课表
    safeGet('import-schedule-btn').onclick = () => document.getElementById('import-modal').style.display = 'flex';
    safeGet('cancel-import').onclick = () => document.getElementById('import-modal').style.display = 'none';
    safeGet('parse-schedule-btn').onclick = () => {
        const text = document.getElementById('schedule-text').value;
        const parsed = parseScheduleText(text);
        if (parsed.length > 0) {
            currentSchedule = parsed;
            saveSchedule(currentSchedule);
            renderScheduleList();
            scheduleReminders(currentSchedule);
        }
        document.getElementById('import-modal').style.display = 'none';
        document.getElementById('schedule-text').value = '';
    };
    
    // 楼层切换
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.onclick = () => filterFloor(parseInt(btn.dataset.floor));
    });
    
    // 双击地图重置视角
    map.on('dblclick', () => map.setView([900, 550], 0));
    
    // ===== 筛选标签：改为弹窗显示列表 =====
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.onclick = () => {
            const type = tag.dataset.type;
            showRoomListModal(type);
        };
    });
    
    // ===== 搜索功能：输入时显示结果，点击结果定位并高亮同类 POI =====
    const searchInput = safeGet('search-input');
    searchInput.oninput = (e) => {
        const val = e.target.value.toLowerCase();
        const results = allRooms.filter(r => 
            r.name.toLowerCase().includes(val) || r.room_id.toLowerCase().includes(val)
        ).slice(0, 8);
        const resDiv = safeGet('search-results');
        resDiv.innerHTML = results.map(r => 
            `<div class="search-result-item" data-id="${r.room_id}" data-type="${r.type}">${r.name} (${r.type})</div>`
        ).join('');
        document.querySelectorAll('.search-result-item').forEach(el => {
            el.onclick = () => {
                const room = allRooms.find(r => r.room_id === el.dataset.id);
                if (room) {
                    // 定位并高亮
                    flyToRoom(room.room_id);
                    // 地图上只显示该类型房间（高亮同类 POI）
                    const targetType = room.type;
                    filterPoiByTypes([targetType]);
                    // 同时将筛选标签的激活状态同步
                    document.querySelectorAll('.filter-tag').forEach(t => {
                        t.classList.toggle('active', t.dataset.type === targetType);
                    });
                    activeTypes = [targetType];
                    resDiv.innerHTML = '';
                }
            };
        });
    };
    
    // 点击搜索框外部关闭结果列表（可选）
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-section')) {
            safeGet('search-results').innerHTML = '';
        }
    });
    
    // 引导关闭
    safeGet('close-guide').onclick = () => document.getElementById('guide-modal').style.display = 'none';
    
    // 提醒设置
    safeGet('reminder-btn').onclick = () => {
        const dd = safeGet('reminder-dropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    };
    safeGet('reminder-time-select').onchange = (e) => setReminderMinutes(parseInt(e.target.value));
    
    // 关闭路径面板
    safeGet('close-route').onclick = () => {
        document.getElementById('route-panel').style.display = 'none';
        clearRoute();
    };

    // 选点导航
    const pickStart = safeGet('pick-start-btn');
    const pickEnd = safeGet('pick-end-btn');
    const navStart = safeGet('start-navigation-btn');
    
// 修改：点击“当前定位”直接模拟定位，不进入选点模式4.18
    pickStart.onclick = () => {
        const mockLoc = setMockLocation();
        if (mockLoc) {
            startPoint = mockLoc;
            document.getElementById('start-point-label').textContent = mockLoc.name;
            document.getElementById('start-navigation-btn').disabled = !(startPoint && endPoint);
        }
    };
    
    pickEnd.onclick = () => {
        window.pickingMode = 'end';
        pickEnd.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
    };
    
    navStart.onclick = () => {
        if (!startPoint || !endPoint) return;
        const path = findPath(startPoint.roomId, endPoint.roomId);
        if (path && path.length > 0) {
            drawRoute(path);
            const endRoom = allRooms.find(r => r.room_id === endPoint.roomId);
            if (endRoom) {
                filterFloor(endRoom.floor_number);
                map.setView([endRoom.center[1], endRoom.center[0]], 1.2);
            }
            document.getElementById('route-panel').style.display = 'block';
            document.getElementById('route-info').innerHTML = `从 ${startPoint.name} 到 ${endPoint.name}`;
        } else {
            alert('路径规划失败');
        }
    };
    
    // 清除选点
    safeGet('clear-points-btn').onclick = () => {
        startPoint = null;
        endPoint = null;
        document.getElementById('start-point-label').textContent = '未选择';
        document.getElementById('end-point-label').textContent = '未选择';
        document.getElementById('start-navigation-btn').disabled = true;
        clearRoute();
        document.getElementById('route-panel').style.display = 'none';
        pickStart.classList.remove('active');
        pickEnd.classList.remove('active');
        map.getContainer().style.cursor = '';
        window.pickingMode = null;
        // 清除模拟定位标记4.18 21：08
        clearMockLocation();
    };
    
    // 关闭房间列表弹窗
    safeGet('close-room-list').onclick = () => {
        document.getElementById('room-list-modal').style.display = 'none';
    };
}

// 显示指定类型的房间列表弹窗
function showRoomListModal(type) {
    let rooms;
    // 特殊处理：办公室类型匹配所有包含“办公室”的房间
    if (type === '办公室') {
        rooms = allRooms.filter(r => r.type.includes('办公室'));
    } else {
        rooms = allRooms.filter(r => r.type === type);
    }
    
    if (rooms.length === 0) {
        alert(`没有找到类型为“${type}”的房间`);
        return;
    }
    
    // 按楼层分组
    const byFloor = {};
    rooms.forEach(r => {
        const f = r.floor_number;
        if (!byFloor[f]) byFloor[f] = [];
        byFloor[f].push(r);
    });
    
    const floors = Object.keys(byFloor).sort((a,b) => a - b);
    let html = '';
    floors.forEach(floor => {
        html += `<div class="room-list-floor-group">`;
        html += `<div class="room-list-floor-title">${floor}F</div>`;
        byFloor[floor].forEach(room => {
            html += `<div class="room-list-item" data-roomid="${room.room_id}">
                        <span>${room.name}</span>
                        <span class="nav-badge">导航</span>
                    </div>`;
        });
        html += `</div>`;
    });
    
    document.getElementById('room-list-title').textContent = `${type} 列表 (共 ${rooms.length} 间)`;
    document.getElementById('room-list-container').innerHTML = html;
    
    // 绑定列表项点击事件
    document.querySelectorAll('.room-list-item').forEach(el => {
        el.onclick = () => {
            const roomId = el.dataset.roomid;
            const room = allRooms.find(r => r.room_id === roomId);
            if (room) {
                  // 如果没有设置起点，自动设为模拟定位4.18 21：13 266-287
                if (!startPoint) {
                    startPoint = setMockLocation();
                    document.getElementById('start-point-label').textContent = startPoint.name;
                }
                endPoint = { roomId: room.room_id, name: room.name, center: room.center };
                document.getElementById('end-point-label').textContent = endPoint.name;
                document.getElementById('start-navigation-btn').disabled = false;
                const path = findPath(startPoint.roomId, endPoint.roomId);
                if (path && path.length > 0) {
                    drawRoute(path);
                    filterFloor(room.floor_number);
                    map.setView([room.center[1], room.center[0]], 1.2);
                    document.getElementById('route-panel').style.display = 'block';
                    document.getElementById('route-info').innerHTML = `前往 ${room.name}`;
                }
                document.getElementById('room-list-modal').style.display = 'none';
            }
        };
    });
    document.getElementById('room-list-modal').style.display = 'flex';
}

function showVacantRoomModal() {
    // 虚拟课表数据，模拟全校教学班占用情况
    const allClassrooms = allRooms.filter(r => r.type.includes('多媒体教室') || r.type.includes('教室'));
    const timeSlots = ['8:00-9:40', '10:00-11:40', '14:00-15:40', '16:00-17:40', '19:00-20:40'];
    const occupied = {
        '1-101': ['8:00-9:40', '14:00-15:40'],
        '1-102': ['10:00-11:40'],
        '2-101': ['14:00-15:40', '19:00-20:40'],
        '3-203': ['8:00-9:40', '10:00-11:40'],
    };
    const capacities = { '1-101': 60, '1-102': 60, '1-103': 60, '2-101': 80, '2-102': 80, '2-103': 80, '3-101': 120, '3-102': 120, '3-203': 100 };
    
    let html = '';
    timeSlots.forEach(slot => {
        const vacant = allClassrooms.filter(room => {
            const occ = occupied[room.room_id] || [];
            return !occ.includes(slot);
        });
        html += `<div style="margin-bottom:16px;"><strong>${slot}</strong> 空闲教室 (${vacant.length}间)</div>`;
        if (vacant.length === 0) {
            html += `<div style="color:#888; margin-left:16px;">暂无空闲</div>`;
        } else {
            vacant.forEach(room => {
                const cap = capacities[room.room_id] || 60;
                html += `<div class="vacant-room-item" style="padding:8px 12px; margin:4px 0; background:#f8faff; border-radius:8px; display:flex; justify-content:space-between; cursor:pointer;" data-roomid="${room.room_id}">
                            <span>${room.name}</span>
                            <span>👥 ${cap}人</span>
                        </div>`;
            });
        }
    });
    document.getElementById('vacant-room-container').innerHTML = html;
    document.querySelectorAll('.vacant-room-item').forEach(el => {
        el.onclick = () => {
            const roomId = el.dataset.roomid;
            const room = allRooms.find(r => r.room_id === roomId);
            if (room) {
                if (!startPoint) {
                    startPoint = setMockLocation();
                    document.getElementById('start-point-label').textContent = startPoint.name;
                }
                endPoint = { roomId: room.room_id, name: room.name, center: room.center };
                document.getElementById('end-point-label').textContent = endPoint.name;
                document.getElementById('start-navigation-btn').disabled = false;
                const path = findPath(startPoint.roomId, endPoint.roomId);
                if (path && path.length > 0) {
                    drawRoute(path);
                    filterFloor(room.floor_number);
                    map.setView([room.center[1], room.center[0]], 1.2);
                    document.getElementById('route-panel').style.display = 'block';
                    document.getElementById('route-info').innerHTML = `前往 ${room.name}`;
                }
                document.getElementById('vacant-room-modal').style.display = 'none';
            }
        };
    });
    document.getElementById('vacant-room-modal').style.display = 'flex';
}




function renderScheduleList() {
    const container = document.getElementById('today-schedule');
    if (!currentSchedule || currentSchedule.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无课程，点击右上角导入</div>';
        return;
    }
    
    container.innerHTML = currentSchedule.map(c => `
        <div class="schedule-item">
            <div class="schedule-info">
                <div class="course-name">${c.name}</div>
                <div class="course-room">📍 ${c.room}</div>
                <div class="course-time" style="font-size:0.8rem;color:#666;">${c.time || ''}</div>
            </div>
            <button class="nav-btn" data-room="${c.room}" data-roomid="${c.roomId || ''}">导航</button>
        </div>
    `).join('');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const roomName = btn.dataset.room;
            let targetRoomId = btn.dataset.roomid;
            if (!targetRoomId || targetRoomId === 'undefined') {
                targetRoomId = mapToRoomId(roomName);
            }
            if (!targetRoomId) {
                alert(`未找到教室: ${roomName}`);
                return;
            }
            const startRoomId = '1-stair1';
            const path = findPath(startRoomId, targetRoomId);
            if (path && path.length > 0) {
                drawRoute(path);
                const targetRoom = allRooms.find(r => r.room_id === targetRoomId);
                if (targetRoom) {
                    filterFloor(targetRoom.floor_number);
                    map.setView([targetRoom.center[1], targetRoom.center[0]], 1.2);
                    document.getElementById('route-panel').style.display = 'block';
                    document.getElementById('route-info').innerHTML = `前往 ${targetRoom.name}`;
                }
            } else {
                alert('路径规划失败');
            }
        };
    });
}

window.navigateToRoom = (targetRoomId) => {
    const startRoomId = '1-stair1';
    const path = findPath(startRoomId, targetRoomId);
    if (path && path.length > 0) {
        drawRoute(path);
        const targetRoom = allRooms.find(r => r.room_id === targetRoomId);
        if (targetRoom) {
            filterFloor(targetRoom.floor_number);
            map.setView([targetRoom.center[1], targetRoom.center[0]], 1.2);
            document.getElementById('route-panel').style.display = 'block';
            document.getElementById('route-info').innerHTML = `前往 ${targetRoom.name}`;
        }
    } else {
        alert('路径规划失败');
    }
};