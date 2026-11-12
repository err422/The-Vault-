import * as cloud from '../cloud.js';

(function() {
    
    // Helper: Get week number in format "2026-W01"
    function getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
    }
    
    // Helper: Get month in format "2026-01"
    function getMonthString(date) {
        const d = new Date(date);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    
    // Helper: Get year in format "2026"
    function getYearString(date) {
        return new Date(date).getFullYear().toString();
    }
    
    // Helper: Calculate days ago from today
    function daysAgo(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        const diffTime = today - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    
    //  Consolidate entries to save space and keep data clean
    async function consolidatePlaytime(userId) {
        try {
            const profile = await cloud.getProfile(userId);
            const data = profile && profile.playtime;
            if (!data) return;

            const playtime = JSON.parse(JSON.stringify(data));
            const daily = playtime.daily || {};
            const weekly = playtime.weekly || {};
            const monthly = playtime.monthly || {};
            const yearly = playtime.yearly || {};
            let changed = false;

            // STEP 1: daily entries older than a week roll into weekly totals
            for (const dateStr of Object.keys(daily)) {
                if (daysAgo(dateStr) >= 7) {
                    const weekStr = getWeekNumber(dateStr);
                    weekly[weekStr] = weekly[weekStr] || {};
                    for (const game in daily[dateStr]) {
                        weekly[weekStr][game] = (Number(weekly[weekStr][game]) || 0) + (Number(daily[dateStr][game]) || 0);
                    }
                    delete daily[dateStr];
                    changed = true;
                }
            }

            // STEP 2: weekly entries older than 4 weeks roll into monthly totals
            for (const weekStr of Object.keys(weekly)) {
                const [year, weekPart] = weekStr.split('-W');
                const weekNum = parseInt(weekPart);
                const jan1 = new Date(year, 0, 1);
                const weekDate = new Date(jan1.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
                if (daysAgo(weekDate.toISOString().split('T')[0]) >= 28) {
                    const monthStr = getMonthString(weekDate);
                    monthly[monthStr] = monthly[monthStr] || {};
                    for (const game in weekly[weekStr]) {
                        monthly[monthStr][game] = (Number(monthly[monthStr][game]) || 0) + (Number(weekly[weekStr][game]) || 0);
                    }
                    delete weekly[weekStr];
                    changed = true;
                }
            }

            // STEP 3: monthly entries older than 12 months roll into yearly totals
            for (const monthStr of Object.keys(monthly)) {
                const monthDate = new Date(monthStr + '-01');
                if (daysAgo(monthDate.toISOString().split('T')[0]) >= 365) {
                    const yearStr = getYearString(monthDate);
                    yearly[yearStr] = yearly[yearStr] || {};
                    for (const game in monthly[monthStr]) {
                        yearly[yearStr][game] = (Number(yearly[yearStr][game]) || 0) + (Number(monthly[monthStr][game]) || 0);
                    }
                    delete monthly[monthStr];
                    changed = true;
                }
            }

            // STEP 4: save once
            if (changed) {
                playtime.daily = daily;
                playtime.weekly = weekly;
                playtime.monthly = monthly;
                playtime.yearly = yearly;
                await cloud.updateProfileFields(userId, { playtime });
            }
        } catch (error) {
            console.error('❌ Error during consolidation:', error);
        }
    }

    // Export the function
    window.consolidatePlaytime = consolidatePlaytime;
    
})();