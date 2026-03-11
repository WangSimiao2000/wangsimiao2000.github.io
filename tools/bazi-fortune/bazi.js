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
        let mDays = getLunarMonthDays(lunarYear, i);

        if (offset >= mDays) {
            offset -= mDays;
        } else {
            lunarDay = offset + 1;
            break;
        }

        if (i === leapMonth && !isLeap) {
            i--;
            isLeap = true;
            mDays = getLeapDays(lunarYear);
        }
    }

    return { year: lunarYear, day: lunarDay };
}

// 节气计算
function getSolarMonth(year, month, day, hour) {
    const solarTerms = {
        1: [6, 0], 2: [4, 6], 3: [6, 0], 4: [5, 6], 5: [6, 0], 6: [6, 6],
        7: [7, 12], 8: [8, 6], 9: [8, 6], 10: [8, 12], 11: [7, 18], 12: [7, 12]
    };

    const [termDay, termHour] = solarTerms[month] || [7, 12];
    const isPassed = (day > termDay) || (day === termDay && hour >= termHour);

    const map = {
        1: [12, 11], 2: [1, 12], 3: [2, 1], 4: [3, 2], 5: [4, 3], 6: [5, 4],
        7: [6, 5], 8: [7, 6], 9: [8, 7], 10: [9, 8], 11: [10, 9], 12: [11, 10]
    };
    return isPassed ? map[month][0] : map[month][1];
}

// 模式切换
document.querySelectorAll('input[name="inputMode"]').forEach(function (r) {
    r.addEventListener('change', function () {
        document.getElementById('solarMode').style.display = r.value === 'solar' ? '' : 'none';
        document.getElementById('manualMode').style.display = r.value === 'manual' ? '' : 'none';
    });
});

// 表单提交
document.getElementById('baziForm').addEventListener('submit', function (e) {
    e.preventDefault();

    var gender = document.getElementById('gender').value;
    var mode = document.querySelector('input[name="inputMode"]:checked').value;
    var year, sm, ld, hour, html = '';
    var mn = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
    var hn = ['子时', '丑时', '丑时', '寅时', '寅时', '卯时', '卯时', '辰时', '辰时', '巳时', '巳时', '午时', '午时', '未时', '未时', '申时', '申时', '酉时', '酉时', '戌时', '戌时', '亥时', '亥时', '子时'];

    if (mode === 'solar') {
        var iY = parseInt(document.getElementById('year').value);
        var m = parseInt(document.getElementById('month').value);
        var d = parseInt(document.getElementById('day').value);
        hour = parseInt(document.getElementById('hour').value);
        var iM = m, iD = d, iH = hour;

        if (hour === 23) {
            hour = 0; d++;
            var md = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            if ((iY % 4 === 0 && iY % 100 !== 0) || (iY % 400 === 0)) md[2] = 29;
            if (d > md[m]) { d = 1; m++; if (m > 12) { m = 1; iY++; } }
        }

        sm = getSolarMonth(iY, m, d, hour);
        var lunar = solarToLunar(iY, m, d);
        year = lunar.year;
        ld = lunar.day;

        var is23 = iH === 23;
        var dd = is23 ? iY + '年' + m + '月' + d + '日' : iY + '年' + iM + '月' + iD + '日';

        html = '<div class="process-item"><strong>输入：</strong>阳历 ' + iY + '年' + iM + '月' + iD + '日 ' + iH + ':00-' + iH + ':59</div>';
        if (is23) html += '<div class="process-item" style="color:var(--link-color)"><strong>时辰调整：</strong>23点算次日子时 → ' + dd + ' 子时</div>';
        html += '<div class="process-item"><strong>阳历转农历：</strong>' + dd + ' → 农历 <strong>' + year + '年' + ld + '日</strong></div>';
        html += '<div class="process-item"><strong>节气转换：</strong>' + dd + ' ' + hn[hour] + ' → 节气月 <strong>' + mn[sm] + '</strong></div>';
    } else {
        year = parseInt(document.getElementById('manualYear').value);
        sm = parseInt(document.getElementById('solarMonth').value);
        ld = parseInt(document.getElementById('lunarDay').value);
        hour = parseInt(document.getElementById('shiChen').value);

        html = '<div class="process-item"><strong>输入：</strong>手动模式</div>';
        html += '<div class="process-item"><strong>年份：</strong>' + year + '年</div>';
        html += '<div class="process-item"><strong>节气月：</strong>' + mn[sm] + '</div>';
        html += '<div class="process-item"><strong>农历日：</strong>农历' + ld + '日</div>';
        html += '<div class="process-item"><strong>时辰：</strong>' + hn[hour] + '</div>';
    }

    var yW = yearWeight[year] || 0;
    var mW = monthWeight[sm] || 0;
    var dW = dayWeight[ld] || 0;
    var hW = hourWeight[hour] || 0;
    var weight = yW + mW + dW + hW;
    var wKey = weight.toFixed(1);
    var poems = gender === 'male' ? malePoems : femalePoems;
    var poem = poems[wKey] || "命运未知，请核对生辰八字。";

    html += '<div class="process-item"><strong>年份骨重：</strong>' + year + '年 = ' + yW + ' 两</div>';
    html += '<div class="process-item"><strong>月份骨重：</strong>节气月 = ' + mW + ' 两</div>';
    html += '<div class="process-item"><strong>日期骨重：</strong>农历' + ld + '日 = ' + dW + ' 两</div>';
    html += '<div class="process-item"><strong>时辰骨重：</strong>= ' + hW + ' 两</div>';
    html += '<div class="process-sum">总计：' + yW + ' + ' + mW + ' + ' + dW + ' + ' + hW + ' = ' + wKey + ' 两</div>';

    document.getElementById('processDisplay').innerHTML = html;
    document.getElementById('weightDisplay').textContent = '骨重：' + wKey + ' 两';
    document.getElementById('poemDisplay').textContent = poem;

    var rs = document.getElementById('result');
    rs.classList.add('show');
    rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
