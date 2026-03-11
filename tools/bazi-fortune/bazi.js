// 农历算法
function getLeapMonth(year) {
    return lunarInfo[year - 1900] & 0xf;
}

function getLeapDays(year) {
    if (getLeapMonth(year)) {
        return (lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
    }
    return 0;
}

function getLunarMonthDays(year, month) {
    return (lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function getLunarYearDays(year) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) {
        sum += (lunarInfo[year - 1900] & i) ? 1 : 0;
    }
    return sum + getLeapDays(year);
}

// 阳历转农历（返回年和日）
function solarToLunar(year, month, day) {
    const baseYear = 1900;
    const baseDay = 31;
    
    // 计算距离1900年1月31日的天数
    let offset = 0;
    for (let i = baseYear; i < year; i++) {
        const yearDays = (i % 4 === 0 && i % 100 !== 0) || (i % 400 === 0) ? 366 : 365;
        offset += yearDays;
    }
    
    const monthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)) {
        monthDays[2] = 29;
    }
    
    for (let i = 1; i < month; i++) {
        offset += monthDays[i];
    }
    offset += day - baseDay;
    
    // 计算农历日期
    let lunarYear = baseYear;
    let lunarDay = 1;
    
    while (offset > 0) {
        const yearDays = getLunarYearDays(lunarYear);
        if (offset >= yearDays) {
            offset -= yearDays;
            lunarYear++;
        } else {
            break;
        }
    }
    
    const leapMonth = getLeapMonth(lunarYear);
    let isLeap = false;
    
    for (let i = 1; i <= 12; i++) {
        let monthDays = getLunarMonthDays(lunarYear, i);
        
        if (offset >= monthDays) {
            offset -= monthDays;
        } else {
            lunarDay = offset + 1;
            break;
        }
        
        // 处理闰月
        if (i === leapMonth && !isLeap) {
            i--;
            isLeap = true;
            monthDays = getLeapDays(lunarYear);
        }
    }
    
    return { year: lunarYear, day: lunarDay };
}

// 节气计算（精确版）
function getSolarMonth(year, month, day, hour) {
    // 节气大致日期和时刻（简化但相对准确）
    // 格式：[日期, 大致小时]
    const solarTerms = {
        1: [6, 0],   // 小寒
        2: [4, 6],   // 立春
        3: [6, 0],   // 惊蛰
        4: [5, 6],   // 清明
        5: [6, 0],   // 立夏
        6: [6, 6],   // 芒种
        7: [7, 12],  // 小暑
        8: [8, 6],   // 立秋
        9: [8, 6],   // 白露
        10: [8, 12], // 寒露
        11: [7, 18], // 立冬
        12: [7, 12]  // 大雪
    };
    
    const [termDay, termHour] = solarTerms[month] || [7, 12];
    
    // 判断是否已过节气
    const isPassed = (day > termDay) || (day === termDay && hour >= termHour);
    
    // 返回对应的节气月
    if (month === 1) return isPassed ? 12 : 11;
    if (month === 2) return isPassed ? 1 : 12;
    if (month === 3) return isPassed ? 2 : 1;
    if (month === 4) return isPassed ? 3 : 2;
    if (month === 5) return isPassed ? 4 : 3;
    if (month === 6) return isPassed ? 5 : 4;
    if (month === 7) return isPassed ? 6 : 5;
    if (month === 8) return isPassed ? 7 : 6;
    if (month === 9) return isPassed ? 8 : 7;
    if (month === 10) return isPassed ? 9 : 8;
    if (month === 11) return isPassed ? 10 : 9;
    return isPassed ? 11 : 10;
}

// 表单提交
document.getElementById('baziForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const gender = document.getElementById('gender').value;
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    
    let year, solarMonth, lunarDay, hour;
    let processHTML = '';
    
    if (mode === 'solar') {
        // 阳历模式
        let inputYear = parseInt(document.getElementById('year').value);
        let month = parseInt(document.getElementById('month').value);
        let day = parseInt(document.getElementById('day').value);
        hour = parseInt(document.getElementById('hour').value);
        
        const inputMonth = month, inputDay = day, inputHour = hour;
        
        // 处理23点
        if (hour === 23) {
            hour = 0;
            day++;
            const monthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if ((inputYear % 4 === 0 && inputYear % 100 !== 0) || (inputYear % 400 === 0)) monthDays[2] = 29;
            if (day > monthDays[month]) {
                day = 1;
                month++;
                if (month > 12) {
                    month = 1;
                    inputYear++;
                }
            }
        }
        
        solarMonth = getSolarMonth(inputYear, month, day, hour);
        const lunar = solarToLunar(inputYear, month, day);
        year = lunar.year;
        lunarDay = lunar.day;
        
        const monthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
        const hourNames = ['子时', '丑时', '丑时', '寅时', '寅时', '卯时', '卯时', '辰时', '辰时', '巳时', '巳时', '午时', '午时', '未时', '未时', '申时', '申时', '酉时', '酉时', '戌时', '戌时', '亥时', '亥时', '子时'];
        
        const is23Hour = inputHour === 23;
        const displayDate = is23Hour ? `${inputYear}年${month}月${day}日` : `${inputYear}年${inputMonth}月${inputDay}日`;
        
        processHTML = `
            <div class="process-item">
                <strong>输入：</strong>阳历 ${inputYear}年${inputMonth}月${inputDay}日 ${inputHour}:00-${inputHour}:59
            </div>
        `;
        
        if (is23Hour) {
            processHTML += `<div class="process-item" style="color: #ffd700;">
                <strong>时辰调整：</strong>23点算次日子时 → ${displayDate} 子时
            </div>`;
        }
        
        processHTML += `
            <div class="process-item">
                <strong>阳历转农历：</strong>${displayDate} → 农历 <strong>${year}年${lunarDay}日</strong>
            </div>
            <div class="process-item">
                <strong>节气转换：</strong>${displayDate} ${hourNames[hour]} → 节气月 <strong>${monthNames[solarMonth]}</strong>
            </div>
        `;
    } else {
        // 手动模式
        year = parseInt(document.getElementById('manualYear').value);
        solarMonth = parseInt(document.getElementById('solarMonth').value);
        lunarDay = parseInt(document.getElementById('lunarDay').value);
        hour = parseInt(document.getElementById('shiChen').value);
        
        const monthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
        const hourNames = ['子时', '丑时', '丑时', '寅时', '寅时', '卯时', '卯时', '辰时', '辰时', '巳时', '巳时', '午时', '午时', '未时', '未时', '申时', '申时', '酉时', '酉时', '戌时', '戌时', '亥时', '亥时', '子时'];
        
        processHTML = `
            <div class="process-item">
                <strong>输入：</strong>手动模式
            </div>
            <div class="process-item">
                <strong>年份：</strong>${year}年
            </div>
            <div class="process-item">
                <strong>节气月：</strong>${monthNames[solarMonth]}
            </div>
            <div class="process-item">
                <strong>农历日：</strong>农历${lunarDay}日
            </div>
            <div class="process-item">
                <strong>时辰：</strong>${hourNames[hour]}
            </div>
        `;
    }
    
    const yearW = yearWeight[year] || 0;
    const monthW = monthWeight[solarMonth] || 0;
    const dayW = dayWeight[lunarDay] || 0;
    const hourW = hourWeight[hour] || 0;
    
    const weight = yearW + monthW + dayW + hourW;
    const weightKey = weight.toFixed(1);
    const poems = gender === 'male' ? malePoems : femalePoems;
    const poem = poems[weightKey] || "命运未知，请核对生辰八字。";
    
    processHTML += `
        <div class="process-item">
            <strong>年份骨重：</strong>${year}年 = ${yearW} 两
        </div>
        <div class="process-item">
            <strong>月份骨重：</strong>节气月 = ${monthW} 两
        </div>
        <div class="process-item">
            <strong>日期骨重：</strong>农历${lunarDay}日 = ${dayW} 两
        </div>
        <div class="process-item">
            <strong>时辰骨重：</strong>= ${hourW} 两
        </div>
        <div class="process-sum">
            总计：${yearW} + ${monthW} + ${dayW} + ${hourW} = ${weight.toFixed(1)} 两
        </div>
    `;
    
    // 更新两个显示区域
    document.getElementById('processDisplay').innerHTML = processHTML;
    document.getElementById('weightDisplay').textContent = `骨重：${weight.toFixed(1)} 两`;
    document.getElementById('poemDisplay').textContent = poem;
    document.getElementById('result').classList.add('show');
    
    document.getElementById('processDisplaySide').innerHTML = processHTML;
    document.getElementById('weightDisplaySide').textContent = `骨重：${weight.toFixed(1)} 两`;
    document.getElementById('poemDisplaySide').textContent = poem;
    document.getElementById('resultContainer').classList.add('show');
});

// 模式切换
document.querySelectorAll('input[name="inputMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        document.getElementById('solarMode').style.display = mode === 'solar' ? 'block' : 'none';
        document.getElementById('manualMode').style.display = mode === 'manual' ? 'block' : 'none';
    });
});
