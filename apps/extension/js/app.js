// Main application logic

const App = {
  selectedDate: null,
  selectedWebsiteDomain: null,

  // Helper to escape HTML for safe insertion (used only for static content with dynamic attributes)
  escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  async init() {
    this.selectedDate = Storage.formatDate(new Date());

    this.renderDateLabel();
    this.renderCaliper();

    // Batch initial data fetch for better performance
    const [habits, entries, freezes] = await Promise.all([
      Storage.getHabits(),
      Storage.getAllEntries(),
      Storage.getStreakFreezes()
    ]);

    // Render with pre-fetched data
    await this.renderChart();
    await this.renderHabitsWithData(habits, entries, freezes);
    await this.updateHabitCounterWithData(habits, entries);
    await this.renderRuler(habits, entries, freezes);
    await this.initWebsitesSection();
    this.bindEvents();
  },

  // Render date label (e.g. "apr 8")
  renderDateLabel() {
    const el = document.getElementById('dateLabel');
    if (!el) return;

    const today = new Date();
    const month = today.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    const day = today.getDate();
    el.textContent = `${month} ${day}`;
  },

  // Render massive vernier caliper spanning viewport width
  renderCaliper() {
    const container = document.getElementById('caliperContainer');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.ceil((today - startOfYear) / 86400000);
    const totalDays = ((today.getFullYear() % 4 === 0) ? 366 : 365);

    const w = 1800, h = 80;
    const beamLeft = 40, beamRight = w - 40;
    const beamWidth = beamRight - beamLeft;
    const jawX = beamLeft + (dayOfYear / totalDays) * beamWidth;
    const jawH = 24; // jaw extension beyond beam

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Main beam body
    const beam = document.createElementNS(ns, 'rect');
    beam.setAttribute('x', beamLeft);
    beam.setAttribute('y', jawH);
    beam.setAttribute('width', beamWidth);
    beam.setAttribute('height', h - jawH * 2);
    beam.setAttribute('fill', 'rgba(60, 56, 54, 0.15)');
    beam.setAttribute('stroke', '#504945');
    beam.setAttribute('stroke-width', '1.5');
    beam.setAttribute('rx', '2');
    svg.appendChild(beam);

    // Fixed jaw (left) — tall block
    const fixedJaw = document.createElementNS(ns, 'rect');
    fixedJaw.setAttribute('x', beamLeft - 8);
    fixedJaw.setAttribute('y', 0);
    fixedJaw.setAttribute('width', 16);
    fixedJaw.setAttribute('height', h);
    fixedJaw.setAttribute('fill', 'rgba(80, 73, 69, 0.3)');
    fixedJaw.setAttribute('stroke', '#a89984');
    fixedJaw.setAttribute('stroke-width', '1.5');
    fixedJaw.setAttribute('rx', '1');
    svg.appendChild(fixedJaw);

    // Sliding jaw — tall block at day position
    const slidingJaw = document.createElementNS(ns, 'rect');
    slidingJaw.setAttribute('x', jawX - 6);
    slidingJaw.setAttribute('y', 0);
    slidingJaw.setAttribute('width', 12);
    slidingJaw.setAttribute('height', h);
    slidingJaw.setAttribute('fill', 'rgba(80, 73, 69, 0.2)');
    slidingJaw.setAttribute('stroke', '#ebdbb2');
    slidingJaw.setAttribute('stroke-width', '2');
    slidingJaw.setAttribute('rx', '1');
    svg.appendChild(slidingJaw);

    // Depth rod extending right from sliding jaw
    const depthRod = document.createElementNS(ns, 'line');
    depthRod.setAttribute('x1', jawX + 6);
    depthRod.setAttribute('y1', h / 2);
    depthRod.setAttribute('x2', beamRight);
    depthRod.setAttribute('y2', h / 2);
    depthRod.setAttribute('stroke', '#504945');
    depthRod.setAttribute('stroke-width', '1');
    svg.appendChild(depthRod);

    // Month ticks along top of beam
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const daysInMonths = [31,28,31,30,31,30,31,31,30,31,30,31];
    if (totalDays === 366) daysInMonths[1] = 29;
    let cumDays = 0;
    for (let i = 0; i < 12; i++) {
      const mx = beamLeft + (cumDays / totalDays) * beamWidth;
      // Major month tick
      const tick = document.createElementNS(ns, 'line');
      tick.setAttribute('x1', mx);
      tick.setAttribute('y1', jawH);
      tick.setAttribute('x2', mx);
      tick.setAttribute('y2', jawH + 14);
      tick.setAttribute('stroke', '#a89984');
      tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);

      // Month label
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', mx + 6);
      label.setAttribute('y', jawH + 12);
      label.setAttribute('fill', '#504945');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', "'0xProto', monospace");
      label.textContent = months[i];
      svg.appendChild(label);

      // Minor ticks within month
      for (let d = 7; d < daysInMonths[i]; d += 7) {
        const dx = beamLeft + ((cumDays + d) / totalDays) * beamWidth;
        const minor = document.createElementNS(ns, 'line');
        minor.setAttribute('x1', dx);
        minor.setAttribute('y1', jawH);
        minor.setAttribute('x2', dx);
        minor.setAttribute('y2', jawH + 8);
        minor.setAttribute('stroke', '#504945');
        minor.setAttribute('stroke-width', '0.5');
        svg.appendChild(minor);
      }

      cumDays += daysInMonths[i];
    }

    // Vernier scale — fine ticks clustered on sliding jaw
    for (let i = -8; i <= 8; i++) {
      const vx = jawX + i * 4;
      if (vx < beamLeft || vx > beamRight) continue;
      const vtick = document.createElementNS(ns, 'line');
      vtick.setAttribute('x1', vx);
      vtick.setAttribute('y1', h - jawH);
      vtick.setAttribute('x2', vx);
      vtick.setAttribute('y2', h - jawH + (i % 5 === 0 ? 10 : 6));
      vtick.setAttribute('stroke', '#a89984');
      vtick.setAttribute('stroke-width', i % 5 === 0 ? '1' : '0.5');
      svg.appendChild(vtick);
    }

    // Reading label below sliding jaw
    const reading = document.createElementNS(ns, 'text');
    reading.setAttribute('x', jawX);
    reading.setAttribute('y', h - 4);
    reading.setAttribute('text-anchor', 'middle');
    reading.setAttribute('fill', '#d65d0e');
    reading.setAttribute('font-size', '12');
    reading.setAttribute('font-family', "'0xProto', monospace");
    reading.textContent = `day ${dayOfYear}`;
    svg.appendChild(reading);

    container.appendChild(svg);
  },

  // Render massive ruler spanning viewport width
  async renderRuler(habits, entries, freezes) {
    const container = document.getElementById('streakRuler');
    if (!container) return;
    container.innerHTML = '';

    if (!habits) habits = await Storage.getHabits();
    if (!entries) entries = await Storage.getAllEntries();

    let bestStreak = 0;
    for (const habit of habits) {
      const streak = await Habits.calculateStreak(habit.id);
      if (streak > bestStreak) bestStreak = streak;
    }

    const ns = 'http://www.w3.org/2000/svg';
    const w = 1800, h = 48;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Ruler body — tall, full width
    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('x', 0);
    body.setAttribute('y', 0);
    body.setAttribute('width', w);
    body.setAttribute('height', h);
    body.setAttribute('fill', 'rgba(60, 56, 54, 0.12)');
    body.setAttribute('stroke', '#504945');
    body.setAttribute('stroke-width', '1');
    body.setAttribute('rx', '2');
    svg.appendChild(body);

    // Top and bottom edge lines (ruler edges)
    for (const y of [6, h - 6]) {
      const edge = document.createElementNS(ns, 'line');
      edge.setAttribute('x1', 0);
      edge.setAttribute('y1', y);
      edge.setAttribute('x2', w);
      edge.setAttribute('y2', y);
      edge.setAttribute('stroke', '#504945');
      edge.setAttribute('stroke-width', '0.5');
      svg.appendChild(edge);
    }

    // Generate tick marks — always show at least 30 days for scale
    const maxDisplay = Math.max(bestStreak, 30);
    const tickSpacing = (w - 80) / maxDisplay;

    for (let i = 0; i <= maxDisplay; i++) {
      const x = 40 + i * tickSpacing;
      const isMajor = i % 10 === 0;
      const isMid = i % 5 === 0;

      const tickH = isMajor ? 20 : (isMid ? 14 : 8);

      // Top ticks
      const tick = document.createElementNS(ns, 'line');
      tick.setAttribute('x1', x);
      tick.setAttribute('y1', 6);
      tick.setAttribute('x2', x);
      tick.setAttribute('y2', 6 + tickH);
      tick.setAttribute('stroke', isMajor ? '#a89984' : '#504945');
      tick.setAttribute('stroke-width', isMajor ? '1.5' : (isMid ? '1' : '0.5'));
      svg.appendChild(tick);

      // Bottom ticks (mirrored)
      const btick = document.createElementNS(ns, 'line');
      btick.setAttribute('x1', x);
      btick.setAttribute('y1', h - 6);
      btick.setAttribute('x2', x);
      btick.setAttribute('y2', h - 6 - tickH);
      btick.setAttribute('stroke', isMajor ? '#a89984' : '#504945');
      btick.setAttribute('stroke-width', isMajor ? '1.5' : (isMid ? '1' : '0.5'));
      svg.appendChild(btick);

      // Number labels at major ticks
      if (isMajor && i > 0) {
        const num = document.createElementNS(ns, 'text');
        num.setAttribute('x', x);
        num.setAttribute('y', h / 2 + 4);
        num.setAttribute('text-anchor', 'middle');
        num.setAttribute('fill', '#a89984');
        num.setAttribute('font-size', '11');
        num.setAttribute('font-family', "'0xProto', monospace");
        num.textContent = String(i);
        svg.appendChild(num);
      }
    }

    // Accent marker at best streak position
    if (bestStreak > 0) {
      const markerX = 40 + bestStreak * tickSpacing;
      // Down-pointing triangle
      const tri = document.createElementNS(ns, 'polygon');
      tri.setAttribute('points', `${markerX-6},0 ${markerX+6},0 ${markerX},10`);
      tri.setAttribute('fill', '#d65d0e');
      svg.appendChild(tri);
      // Up-pointing triangle
      const tri2 = document.createElementNS(ns, 'polygon');
      tri2.setAttribute('points', `${markerX-6},${h} ${markerX+6},${h} ${markerX},${h-10}`);
      tri2.setAttribute('fill', '#d65d0e');
      svg.appendChild(tri2);

      // Streak label
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', markerX);
      label.setAttribute('y', h / 2 + 4);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#d65d0e');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-family', "'0xProto', monospace");
      label.textContent = `${bestStreak}d`;
      svg.appendChild(label);
    }

    container.appendChild(svg);
  },

  // Render large protractor in bottom-right corner
  renderProtractor(completed, total) {
    const container = document.getElementById('protractorContainer');
    if (!container) return;
    container.innerHTML = '';

    const pct = total > 0 ? completed / total : 0;
    const angle = pct * Math.PI;

    const ns = 'http://www.w3.org/2000/svg';
    const w = 280, h = 160;
    const cx = w / 2, cy = h - 16;
    const r = 120;

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // Outer arc
    const arc = document.createElementNS(ns, 'path');
    arc.setAttribute('d', `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', '#504945');
    arc.setAttribute('stroke-width', '2');
    svg.appendChild(arc);

    // Inner arc
    const innerR = r - 20;
    const innerArc = document.createElementNS(ns, 'path');
    innerArc.setAttribute('d', `M ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 0 1 ${cx + innerR} ${cy}`);
    innerArc.setAttribute('fill', 'none');
    innerArc.setAttribute('stroke', '#3c3836');
    innerArc.setAttribute('stroke-width', '1');
    svg.appendChild(innerArc);

    // Baseline
    const baseline = document.createElementNS(ns, 'line');
    baseline.setAttribute('x1', cx - r - 8);
    baseline.setAttribute('y1', cy);
    baseline.setAttribute('x2', cx + r + 8);
    baseline.setAttribute('y2', cy);
    baseline.setAttribute('stroke', '#504945');
    baseline.setAttribute('stroke-width', '1.5');
    svg.appendChild(baseline);

    // Tick marks every 10 degrees, labels every 30
    for (let deg = 0; deg <= 180; deg += 10) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isMid = deg % 10 === 0;
      const outerR = r;
      const tickInner = isMajor ? r - 16 : r - 10;

      const x1 = cx - Math.cos(rad) * outerR;
      const y1 = cy - Math.sin(rad) * outerR;
      const x2 = cx - Math.cos(rad) * tickInner;
      const y2 = cy - Math.sin(rad) * tickInner;

      const tick = document.createElementNS(ns, 'line');
      tick.setAttribute('x1', x1);
      tick.setAttribute('y1', y1);
      tick.setAttribute('x2', x2);
      tick.setAttribute('y2', y2);
      tick.setAttribute('stroke', isMajor ? '#a89984' : '#504945');
      tick.setAttribute('stroke-width', isMajor ? '1.5' : '0.75');
      svg.appendChild(tick);

      // Degree labels at 30-degree intervals
      if (isMajor) {
        const labelR = r - 24;
        const lx = cx - Math.cos(rad) * labelR;
        const ly = cy - Math.sin(rad) * labelR;
        const degLabel = document.createElementNS(ns, 'text');
        degLabel.setAttribute('x', lx);
        degLabel.setAttribute('y', ly + 3);
        degLabel.setAttribute('text-anchor', 'middle');
        degLabel.setAttribute('fill', '#504945');
        degLabel.setAttribute('font-size', '9');
        degLabel.setAttribute('font-family', "'0xProto', monospace");
        degLabel.textContent = `${deg}`;
        svg.appendChild(degLabel);
      }
    }

    // Needle — accent orange
    const needleX = cx - Math.cos(angle) * (r - 6);
    const needleY = cy - Math.sin(angle) * (r - 6);
    const needle = document.createElementNS(ns, 'line');
    needle.setAttribute('x1', cx);
    needle.setAttribute('y1', cy);
    needle.setAttribute('x2', needleX);
    needle.setAttribute('y2', needleY);
    needle.setAttribute('stroke', '#d65d0e');
    needle.setAttribute('stroke-width', '2');
    needle.setAttribute('stroke-linecap', 'round');
    svg.appendChild(needle);

    // Center pivot
    const pivot = document.createElementNS(ns, 'circle');
    pivot.setAttribute('cx', cx);
    pivot.setAttribute('cy', cy);
    pivot.setAttribute('r', '4');
    pivot.setAttribute('fill', '#504945');
    pivot.setAttribute('stroke', '#a89984');
    pivot.setAttribute('stroke-width', '1');
    svg.appendChild(pivot);

    // Percentage label
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy - 28);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#a89984');
    label.setAttribute('font-size', '16');
    label.setAttribute('font-family', "'0xProto', monospace");
    label.textContent = `${Math.round(pct * 100)}%`;
    svg.appendChild(label);

    container.appendChild(svg);
  },

  // Render the year chart
  async renderChart() {
    const container = document.getElementById('chartContainer');
    await Chart.render(container, (dateStr) => this.selectDate(dateStr));
  },

  // Habit templates for quick start
  habitTemplates: [
    { name: 'exercise', type: 'binary', target: 1 },
    { name: 'read', type: 'binary', target: 1 },
    { name: 'meditate', type: 'binary', target: 1 },
    { name: 'water', type: 'count', target: 8 },
    { name: 'sleep 8h', type: 'binary', target: 1 }
  ],

  // Render today's habits or selected day
  async renderHabits() {
    const habits = await Storage.getHabits();
    const entries = await Storage.getAllEntries();
    return this.renderHabitsWithData(habits, entries);
  },

  // Render habits with pre-fetched data (for batched loading)
  async renderHabitsWithData(habits, entries, freezes = null) {
    const container = document.getElementById('habitsList');
    const todayStr = Storage.formatDate(new Date());
    const isToday = this.selectedDate === todayStr;

    // Clear container
    container.innerHTML = '';

    if (habits.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';

      const title = document.createElement('div');
      title.className = 'empty-state-title';
      title.textContent = 'no habits yet';

      const text = document.createElement('div');
      text.className = 'empty-state-text';
      text.textContent = 'pick a template or create your own';

      emptyState.appendChild(title);
      emptyState.appendChild(text);

      // Add template buttons
      const templateGrid = document.createElement('div');
      templateGrid.className = 'template-grid';

      for (const template of this.habitTemplates) {
        const btn = document.createElement('button');
        btn.className = 'template-btn';
        btn.dataset.templateName = template.name;
        btn.dataset.templateType = template.type;
        btn.dataset.templateTarget = template.target;
        btn.textContent = template.name;
        templateGrid.appendChild(btn);
      }

      emptyState.appendChild(templateGrid);
      container.appendChild(emptyState);

      // Bind template button clicks
      templateGrid.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.templateName;
          const type = btn.dataset.templateType;
          const target = parseInt(btn.dataset.templateTarget) || 1;

          const habit = Habits.createHabit(name, type, target);
          try {
            await Storage.saveHabit(habit);
            await this.renderHabits();
            await this.updateHabitCounter();
            Toast.success(`added "${name}"`);
          } catch (error) {
            Toast.error(error.message);
          }
        });
      });

      return;
    }

    const dayEntries = entries[this.selectedDate] || {};

    // Calculate streaks for all habits (only for today view)
    const streaks = {};
    if (isToday) {
      for (const habit of habits) {
        streaks[habit.id] = await Habits.calculateStreak(habit.id);
      }
    }

    // Check if selected date is in the past (can edit) vs future (cannot)
    const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
    const todayDateObj = new Date(todayStr + 'T00:00:00');
    const isPastOrToday = selectedDateObj <= todayDateObj;
    const canEdit = isPastOrToday;

    for (const habit of habits) {
      // Check if habit existed on the selected date
      if (habit.createdAt > this.selectedDate) continue;

      const entry = dayEntries[habit.id] || { completed: false, value: 0 };
      const isCompleted = Habits.isCompleted(entry, habit);
      const streak = streaks[habit.id] || 0;

      const habitItem = document.createElement('div');
      habitItem.className = `habit-item ${isCompleted ? 'completed' : ''}${!isToday && canEdit ? ' past-date' : ''}`;

      if (habit.type === 'binary') {
        if (canEdit) {
          const label = document.createElement('label');
          label.className = 'habit-checkbox';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.habitId = habit.id;
          checkbox.checked = isCompleted;

          const checkmark = document.createElement('span');
          checkmark.className = 'checkmark';

          label.appendChild(checkbox);
          label.appendChild(checkmark);
          habitItem.appendChild(label);
        } else {
          const status = document.createElement('span');
          status.className = 'habit-status';
          status.textContent = isCompleted ? '\u2713' : '\u25CB';
          habitItem.appendChild(status);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'habit-name';
        nameSpan.textContent = habit.name;
        habitItem.appendChild(nameSpan);

        // Inline streak for today view (plain number)
        if (isToday && streak > 0) {
          const streakSpan = document.createElement('span');
          streakSpan.className = 'habit-inline-streak';
          streakSpan.textContent = `${streak}d`;
          habitItem.appendChild(streakSpan);
        }
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'habit-name';
        nameSpan.textContent = habit.name;
        habitItem.appendChild(nameSpan);

        // Inline streak for today view (plain number)
        if (isToday && streak > 0) {
          const streakSpan = document.createElement('span');
          streakSpan.className = 'habit-inline-streak';
          streakSpan.textContent = `${streak}d`;
          habitItem.appendChild(streakSpan);
        }

        const progressPercent = Math.min(100, (entry.value / habit.target) * 100);

        if (canEdit) {
          const counter = document.createElement('div');
          counter.className = 'habit-counter';

          const minusBtn = document.createElement('button');
          minusBtn.className = 'counter-btn minus';
          minusBtn.dataset.habitId = habit.id;
          minusBtn.textContent = '\u2212';

          const progress = document.createElement('div');
          progress.className = 'habit-progress';

          const counterValue = document.createElement('span');
          counterValue.className = 'counter-value';
          counterValue.textContent = `${entry.value}/${habit.target}`;

          const progressBar = document.createElement('div');
          progressBar.className = 'habit-progress-bar';

          const progressFill = document.createElement('div');
          progressFill.className = 'habit-progress-fill';
          progressFill.style.width = `${progressPercent}%`;

          progressBar.appendChild(progressFill);
          progress.appendChild(counterValue);
          progress.appendChild(progressBar);

          const plusBtn = document.createElement('button');
          plusBtn.className = 'counter-btn plus';
          plusBtn.dataset.habitId = habit.id;
          plusBtn.textContent = '+';

          counter.appendChild(minusBtn);
          counter.appendChild(progress);
          counter.appendChild(plusBtn);
          habitItem.appendChild(counter);
        } else {
          const progress = document.createElement('div');
          progress.className = 'habit-progress';

          const valueSpan = document.createElement('span');
          valueSpan.className = 'habit-value';
          valueSpan.textContent = `${entry.value}/${habit.target}`;

          const progressBar = document.createElement('div');
          progressBar.className = 'habit-progress-bar';

          const progressFill = document.createElement('div');
          progressFill.className = 'habit-progress-fill';
          progressFill.style.width = `${progressPercent}%`;

          progressBar.appendChild(progressFill);
          progress.appendChild(valueSpan);
          progress.appendChild(progressBar);
          habitItem.appendChild(progress);
        }
      }

      container.appendChild(habitItem);
    }

    this.bindHabitEvents();
  },

  // Currently viewed habit in detail modal
  detailHabitId: null,

  // Show habit detail modal with year view
  async showHabitDetail(habitId) {
    const habits = await Storage.getHabits();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    this.detailHabitId = habitId;

    const currentStreak = await Habits.calculateStreak(habitId);
    const bestStreak = await Habits.calculateBestStreak(habitId);
    const stats = await Habits.getCompletionStats(habitId);

    const createdDate = new Date(habit.createdAt);
    const formattedDate = createdDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).toLowerCase();

    document.getElementById('habitDetailName').textContent = habit.name;
    document.getElementById('habitDetailCurrentStreak').textContent = currentStreak;
    document.getElementById('habitDetailBestStreak').textContent = bestStreak;
    document.getElementById('habitDetailCompletionRate').textContent = `${Math.round(stats.completionRate * 100)}%`;
    document.getElementById('habitDetailCreatedAt').textContent = formattedDate;

    await this.updateFreezeSection(habitId);

    const chartContainer = document.getElementById('habitDetailYearChart');
    await Chart.renderHabitYearChart(chartContainer, habitId);

    this.openModal('habitDetailModal');
  },

  // Update the freeze section in habit detail modal
  async updateFreezeSection(habitId) {
    const freezes = await Storage.getStreakFreezes();
    const habitFreezes = freezes[habitId] || [];
    const freezeCount = habitFreezes.length;

    document.getElementById('freezeCount').textContent = `${freezeCount} used`;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = Storage.formatDate(yesterday);

    const habits = await Storage.getHabits();
    const habit = habits.find(h => h.id === habitId);
    const entries = await Storage.getAllEntries();
    const yesterdayEntry = entries[yesterdayStr]?.[habitId];
    const yesterdayCompleted = Habits.isCompleted(yesterdayEntry, habit);
    const yesterdayFrozen = habitFreezes.includes(yesterdayStr);

    const freezeBtn = document.getElementById('freezeYesterdayBtn');
    if (yesterdayCompleted) {
      freezeBtn.textContent = 'yesterday completed';
      freezeBtn.disabled = true;
    } else if (yesterdayFrozen) {
      freezeBtn.textContent = 'yesterday frozen';
      freezeBtn.disabled = true;
    } else if (yesterdayStr < habit.createdAt) {
      freezeBtn.textContent = 'habit not created yet';
      freezeBtn.disabled = true;
    } else {
      freezeBtn.textContent = 'freeze yesterday';
      freezeBtn.disabled = false;
    }
  },

  // Update the habit counter display
  async updateHabitCounter() {
    const habits = await Storage.getHabits();
    const entries = await Storage.getAllEntries();
    return this.updateHabitCounterWithData(habits, entries);
  },

  // Update habit counter with pre-fetched data
  async updateHabitCounterWithData(habits, entries) {
    const count = habits.length;
    const max = Storage.MAX_HABITS;
    const addBtn = document.getElementById('addHabitBtn');
    const todayStr = Storage.formatDate(new Date());
    const dayEntries = entries[todayStr] || {};

    let completedToday = 0;
    for (const habit of habits) {
      const entry = dayEntries[habit.id];
      if (Habits.isCompleted(entry, habit)) {
        completedToday++;
      }
    }

    // Update progress text
    const progressEl = document.getElementById('habitProgress');
    if (progressEl) {
      progressEl.classList.remove('perfect-day');
      if (count > 0) {
        progressEl.textContent = `${completedToday}/${count}`;
        if (completedToday === count) {
          progressEl.classList.add('perfect-day');
        }
      } else {
        progressEl.textContent = '';
      }
    }

    // Update protractor
    this.renderProtractor(completedToday, count);

    if (addBtn) {
      addBtn.disabled = count >= max;
      addBtn.style.display = count >= max ? 'none' : 'block';
    }
  },

  // Select a date to view
  async selectDate(dateStr) {
    this.selectedDate = dateStr;
    const todayStr = Storage.formatDate(new Date());
    const dateLabel = document.getElementById('dateLabel');

    if (dateStr === todayStr) {
      this.renderDateLabel();
    } else {
      const selectedDate = new Date(dateStr + 'T00:00:00');
      const month = selectedDate.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
      const day = selectedDate.getDate();
      dateLabel.textContent = `${month} ${day}`;
    }

    // Update selected cell styling
    document.querySelectorAll('.chart-cell.selected').forEach(el => {
      el.classList.remove('selected');
    });
    const cell = document.querySelector(`[data-date="${dateStr}"]`);
    if (cell) {
      cell.classList.add('selected');
    }

    await this.renderHabits();
    this.showSelectedDayDetails(dateStr);
  },

  // Show details for selected day
  async showSelectedDayDetails(dateStr) {
    const container = document.getElementById('selectedDayDetails');
    const todayStr = Storage.formatDate(new Date());

    container.innerHTML = '';

    if (dateStr === todayStr) {
      return;
    }

    const rate = await Habits.getCompletionRate(dateStr);

    const details = document.createElement('div');
    details.className = 'day-details';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'day-details-date';
    dateSpan.textContent = dateStr;

    const rateSpan = document.createElement('span');
    rateSpan.className = 'day-details-rate';
    const pct = Math.round(rate * 100);
    let narrative = '';
    if (pct === 100) narrative = ' — perfect';
    else if (pct >= 80) narrative = ' — strong';
    else if (pct > 0) narrative = ' — incomplete';
    else narrative = ' — rest day';
    rateSpan.textContent = `${pct}%${narrative}`;

    details.appendChild(dateSpan);
    details.appendChild(rateSpan);
    container.appendChild(details);
  },

  // Bind habit-specific events
  bindHabitEvents() {
    // Binary habit checkboxes
    document.querySelectorAll('.habit-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const habitId = e.target.dataset.habitId;
        const value = e.target.checked ? 1 : 0;

        await Storage.saveEntry(this.selectedDate, habitId, value);
        await this.renderChart();
        await this.renderHabits();
        await this.updateHabitCounter();
        await this.renderRuler();
      });
    });

    // Count habit buttons
    document.querySelectorAll('.counter-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const habitId = e.target.dataset.habitId;
        const isPlus = e.target.classList.contains('plus');

        const habits = await Storage.getHabits();
        const entries = await Storage.getAllEntries();
        const entry = entries[this.selectedDate]?.[habitId] || { value: 0 };
        const newValue = Math.max(0, entry.value + (isPlus ? 1 : -1));

        await Storage.saveEntry(this.selectedDate, habitId, newValue);
        await this.renderChart();
        await this.renderHabits();
        await this.updateHabitCounter();
        await this.renderRuler();
      });
    });
  },

  // Helper to open a modal with accessibility
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    A11y.initModal(modal);
  },

  // Helper to close a modal with accessibility
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    A11y.closeModal(modal);
  },

  // Bind global events
  bindEvents() {
    // Website usage toggle (collapsible)
    const websitesToggle = document.getElementById('websitesToggle');
    const categoryGroups = document.getElementById('categoryGroups');
    if (websitesToggle && categoryGroups) {
      websitesToggle.addEventListener('click', () => {
        const isExpanded = websitesToggle.getAttribute('aria-expanded') === 'true';
        websitesToggle.setAttribute('aria-expanded', !isExpanded);
        categoryGroups.classList.toggle('expanded', !isExpanded);
      });
    }

    // Close website detail modal
    document.getElementById('closeDetailBtn').addEventListener('click', () => {
      this.closeModal('websiteDetailModal');
    });
    document.getElementById('closeDetailBtnX').addEventListener('click', () => {
      this.closeModal('websiteDetailModal');
    });

    // Close habit detail modal
    document.getElementById('closeHabitDetailBtn').addEventListener('click', () => {
      this.closeModal('habitDetailModal');
    });

    // Freeze yesterday button
    document.getElementById('freezeYesterdayBtn').addEventListener('click', async () => {
      if (!this.detailHabitId) return;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = Storage.formatDate(yesterday);

      await Storage.addStreakFreeze(this.detailHabitId, yesterdayStr);

      await this.updateFreezeSection(this.detailHabitId);
      const currentStreak = await Habits.calculateStreak(this.detailHabitId);
      document.getElementById('habitDetailCurrentStreak').textContent = currentStreak;

      await this.renderHabits();
      await this.renderChart();

      Toast.success('streak protected');
    });

    // Website category change in detail modal
    this.bindWebsiteCategoryChange();

    // Add category button
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      this.closeModal('settingsModal');
      this.openModal('addCategoryModal');
    });

    // Cancel add category
    document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
      this.closeModal('addCategoryModal');
      document.getElementById('addCategoryForm').reset();
      this.openModal('settingsModal');
    });

    // Add category form submit
    document.getElementById('addCategoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('categoryName').value;
      const color = document.getElementById('categoryColor').value;

      const category = {
        id: Websites.generateCategoryId(),
        name,
        color,
        isDefault: false
      };

      await Storage.saveWebsiteCategory(category);

      this.closeModal('addCategoryModal');
      document.getElementById('addCategoryForm').reset();
      this.openModal('settingsModal');

      await this.renderCategoriesManageList();
      await this.renderWebsites();
    });

    // Add habit button
    document.getElementById('addHabitBtn').addEventListener('click', () => {
      this.openModal('addHabitModal');
    });

    // Cancel add habit
    document.getElementById('cancelHabitBtn').addEventListener('click', () => {
      this.closeModal('addHabitModal');
      document.getElementById('addHabitForm').reset();
    });

    // Habit type change
    document.getElementById('habitType').addEventListener('change', (e) => {
      const targetGroup = document.getElementById('targetGroup');
      const hint = document.getElementById('habitTypeHint');
      const isCount = e.target.value === 'count';
      targetGroup.style.display = isCount ? 'block' : 'none';
      hint.textContent = isCount
        ? 'set a daily goal to reach'
        : 'check off when completed';
    });

    // Add habit form submit
    document.getElementById('addHabitForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('habitName').value;
      const type = document.getElementById('habitType').value;
      const target = parseInt(document.getElementById('habitTarget').value) || 1;

      const habit = Habits.createHabit(name, type, target);

      try {
        await Storage.saveHabit(habit);

        this.closeModal('addHabitModal');
        document.getElementById('addHabitForm').reset();
        this.hideFormError();

        await this.renderHabits();
        await this.updateHabitCounter();
      } catch (error) {
        this.showFormError(error.message);
      }
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          A11y.closeModal(modal);
        }
      });
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', async () => {
      const data = await Storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foxhole-${Storage.formatDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    // Import file change
    document.getElementById('importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          await Storage.importData(event.target.result);
          await this.renderChart();
          await this.renderHabits();
          await this.updateHabitCounter();
          Toast.success('data imported');
        } catch (error) {
          Toast.error('import failed: ' + error.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', async () => {
      await this.renderSettingsModal();
      this.openModal('settingsModal');
    });

    // Close settings
    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      this.closeModal('settingsModal');
    });
  },

  // Show error message in add habit form
  showFormError(message) {
    let errorEl = document.getElementById('habitFormError');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'habitFormError';
      errorEl.className = 'form-error';
      const form = document.getElementById('addHabitForm');
      form.insertBefore(errorEl, form.firstChild);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  },

  // Hide error message in add habit form
  hideFormError() {
    const errorEl = document.getElementById('habitFormError');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  },

  // Render settings modal content
  async renderSettingsModal() {
    const habits = await Storage.getHabits();
    const container = document.getElementById('habitsManageList');

    container.innerHTML = '';

    if (habits.length === 0) {
      const noHabits = document.createElement('div');
      noHabits.className = 'no-habits';
      noHabits.textContent = 'no habits to manage.';
      container.appendChild(noHabits);
    } else {
      for (const habit of habits) {
        const item = document.createElement('div');
        item.className = 'habit-manage-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'habit-manage-name';
        nameSpan.textContent = habit.name;

        const typeSpan = document.createElement('span');
        typeSpan.className = 'habit-manage-type';
        typeSpan.textContent = habit.type === 'binary' ? 'yes/no' : `count (${habit.target})`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'habit-manage-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-habit-btn';
        editBtn.dataset.habitId = habit.id;
        editBtn.textContent = 'edit';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-habit-btn';
        deleteBtn.dataset.habitId = habit.id;
        deleteBtn.textContent = 'delete';

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        item.appendChild(nameSpan);
        item.appendChild(typeSpan);
        item.appendChild(actionsDiv);
        container.appendChild(item);
      }

      // Bind edit buttons
      container.querySelectorAll('.edit-habit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const habitId = e.target.dataset.habitId;
          this.closeModal('settingsModal');
          this.openEditHabitModal(habitId);
        });
      });

      // Bind delete buttons
      container.querySelectorAll('.delete-habit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const habitId = e.target.dataset.habitId;
          const habit = habits.find(h => h.id === habitId);
          const confirmed = await Confirm.show({
            title: 'delete habit',
            message: `delete "${habit?.name || 'this habit'}"? this will permanently remove all tracking history.`,
            confirmText: 'delete',
            cancelText: 'keep',
            destructive: true
          });
          if (confirmed) {
            await Storage.deleteHabit(habitId);
            await this.renderSettingsModal();
            await this.renderChart();
            await this.renderHabits();
            await this.updateHabitCounter();
            Toast.success('habit deleted');
          }
        });
      });
    }

    // Render categories section
    await this.renderCategoriesManageList();
  },

  // Render categories management in settings
  async renderCategoriesManageList() {
    const categories = await Storage.getWebsiteCategories();
    const container = document.getElementById('categoriesManageList');

    container.innerHTML = '';

    for (const category of categories) {
      const item = document.createElement('div');
      item.className = 'category-manage-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'category-manage-name';
      nameSpan.textContent = category.name;

      item.appendChild(nameSpan);

      if (!category.isDefault) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-category-btn';
        deleteBtn.dataset.categoryId = category.id;
        deleteBtn.textContent = 'delete';
        item.appendChild(deleteBtn);
      }

      container.appendChild(item);
    }

    // Bind delete buttons
    container.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const categoryId = e.target.dataset.categoryId;
        const category = categories.find(c => c.id === categoryId);
        const confirmed = await Confirm.show({
          title: 'delete category',
          message: `delete "${category?.name || 'this category'}"? websites in this category will become uncategorized.`,
          confirmText: 'delete',
          cancelText: 'keep',
          destructive: true
        });
        if (confirmed) {
          await Storage.deleteWebsiteCategory(categoryId);
          await this.renderCategoriesManageList();
          await this.renderWebsites();
          Toast.success('category deleted');
        }
      });
    });
  },

  // ============== Website Section Methods ==============

  // Initialize websites section
  async initWebsitesSection() {
    await this.renderWebsites();
  },

  // Render websites grouped by category
  async renderWebsites() {
    const websites = await Websites.getTodayWebsites();
    const categories = await Storage.getWebsiteCategories();
    const container = document.getElementById('categoryGroups');
    const totalTimeEl = document.getElementById('websitesTotalTime');

    // Calculate total time
    const totalSeconds = websites.reduce((sum, w) => sum + w.totalSeconds, 0);
    totalTimeEl.textContent = Websites.formatTime(totalSeconds);

    // Group websites by category
    const grouped = {};
    for (const cat of categories) {
      grouped[cat.id] = { category: cat, websites: [], totalSeconds: 0 };
    }
    grouped['uncategorized'] = {
      category: { id: 'uncategorized', name: 'other', color: '#504945' },
      websites: [],
      totalSeconds: 0
    };

    for (const website of websites) {
      const catId = website.category?.id || 'uncategorized';
      if (grouped[catId]) {
        grouped[catId].websites.push(website);
        grouped[catId].totalSeconds += website.totalSeconds;
      }
    }

    container.innerHTML = '';

    for (const cat of categories) {
      const group = grouped[cat.id];
      if (group.totalSeconds > 0) {
        container.appendChild(this.renderCategoryGroup(group));
      }
    }
    if (grouped['uncategorized'].totalSeconds > 0) {
      container.appendChild(this.renderCategoryGroup(grouped['uncategorized']));
    }

    // Bind click events for detail view
    container.querySelectorAll('.website-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showWebsiteDetail(card.dataset.domain);
      });
    });
  },

  // Render a single category group
  renderCategoryGroup(group) {
    const { category, websites, totalSeconds } = group;

    const groupEl = document.createElement('div');
    groupEl.className = 'category-group';

    const header = document.createElement('div');
    header.className = 'category-group-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-group-name';
    nameSpan.textContent = category.name;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'category-group-time';
    timeSpan.textContent = Websites.formatTime(totalSeconds);

    header.appendChild(nameSpan);
    header.appendChild(timeSpan);
    groupEl.appendChild(header);

    const websitesEl = document.createElement('div');
    websitesEl.className = 'category-websites';

    for (const website of websites) {
      const card = document.createElement('div');
      card.className = 'website-card';
      card.dataset.domain = website.domain;

      const favicon = document.createElement('img');
      favicon.className = 'website-card-favicon';
      favicon.src = website.favicon;
      favicon.alt = '';
      favicon.onerror = function() {
        this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23666%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>';
      };

      const domainSpan = document.createElement('span');
      domainSpan.className = 'website-card-domain';
      domainSpan.textContent = this.truncateDomain(website.displayName);

      const cardTimeSpan = document.createElement('span');
      cardTimeSpan.className = 'website-card-time';
      cardTimeSpan.textContent = Websites.formatTime(website.totalSeconds);

      card.appendChild(favicon);
      card.appendChild(domainSpan);
      card.appendChild(cardTimeSpan);
      websitesEl.appendChild(card);
    }

    groupEl.appendChild(websitesEl);
    return groupEl;
  },

  // Truncate domain for card display
  truncateDomain(domain) {
    let short = domain.replace(/^(www\.|m\.)/, '');
    short = short.replace(/\.(com|org|net|io|co)$/, '');
    if (short.length > 12) {
      short = short.substring(0, 11) + '...';
    }
    return short;
  },

  // Show website detail modal
  async showWebsiteDetail(domain) {
    this.selectedWebsiteDomain = domain;

    const websites = await Websites.getTodayWebsites();
    const website = websites.find(w => w.domain === domain);

    document.getElementById('detailFavicon').src = website?.favicon || `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    document.getElementById('detailDomain').textContent = domain;
    document.getElementById('detailTodayTime').textContent = Websites.formatTime(website?.totalSeconds || 0);

    const categories = await Storage.getWebsiteCategories();
    const currentCategoryId = await Websites.getCategoryForDomain(domain);
    const select = document.getElementById('detailCategorySelect');

    select.innerHTML = '';

    const uncategorizedOption = document.createElement('option');
    uncategorizedOption.value = '';
    uncategorizedOption.textContent = 'uncategorized';
    select.appendChild(uncategorizedOption);

    for (const category of categories) {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      if (category.id === currentCategoryId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    const settings = await Storage.getWebsiteSettings();
    const currentLimit = settings[domain]?.dailyLimitSeconds || null;
    const limitMinutes = currentLimit ? Math.floor(currentLimit / 60) : '';
    document.getElementById('timeLimitInput').value = limitMinutes;

    const remaining = await Websites.getRemainingTime(domain);
    const remainingEl = document.getElementById('remainingTime');
    if (remaining !== null) {
      remainingEl.textContent = remaining > 0
        ? `${Websites.formatTime(remaining)} remaining today`
        : 'limit reached';
      remainingEl.classList.toggle('exceeded', remaining <= 0);
    } else {
      remainingEl.textContent = '';
      remainingEl.classList.remove('exceeded');
    }

    const weeklyTrend = await Websites.getWeeklyTrend(domain);
    const monthlyTrend = await Websites.getMonthlyTrend(domain);

    WebsiteChart.renderWeeklyBarChart(document.getElementById('weeklyTrendChart'), weeklyTrend);
    WebsiteChart.renderMonthlyLineChart(document.getElementById('monthlyTrendChart'), monthlyTrend);

    this.openModal('websiteDetailModal');
  },

  // Bind website category change
  bindWebsiteCategoryChange() {
    document.getElementById('detailCategorySelect').addEventListener('change', async (e) => {
      const categoryId = e.target.value || null;
      await Storage.setWebsiteSetting(this.selectedWebsiteDomain, { categoryId });
      await this.renderWebsites();
    });

    // Time limit input
    document.getElementById('timeLimitInput').addEventListener('change', async (e) => {
      const minutes = parseInt(e.target.value, 10);
      const seconds = minutes > 0 ? minutes * 60 : null;

      await Storage.setWebsiteSetting(this.selectedWebsiteDomain, {
        dailyLimitSeconds: seconds
      });

      const remaining = await Websites.getRemainingTime(this.selectedWebsiteDomain);
      const remainingEl = document.getElementById('remainingTime');
      if (remaining !== null) {
        remainingEl.textContent = remaining > 0
          ? `${Websites.formatTime(remaining)} remaining today`
          : 'limit reached';
        remainingEl.classList.toggle('exceeded', remaining <= 0);
      } else {
        remainingEl.textContent = '';
        remainingEl.classList.remove('exceeded');
      }

      await this.renderWebsites();
      Toast.success(seconds ? `limit set: ${minutes}m/day` : 'limit removed');
    });

    // Edit habit type change
    document.getElementById('editHabitType').addEventListener('change', (e) => {
      const targetGroup = document.getElementById('editTargetGroup');
      const hint = document.getElementById('editHabitTypeHint');
      const isCount = e.target.value === 'count';
      targetGroup.style.display = isCount ? 'block' : 'none';
      hint.textContent = isCount
        ? 'set a daily goal to reach'
        : 'check off when completed';
    });

    // Cancel edit habit
    document.getElementById('cancelEditHabitBtn').addEventListener('click', () => {
      this.closeModal('editHabitModal');
      document.getElementById('editHabitForm').reset();
      this.openModal('settingsModal');
    });

    // Edit habit form submit
    document.getElementById('editHabitForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveEditedHabit();
    });
  },

  // Open edit habit modal with pre-filled data
  async openEditHabitModal(habitId) {
    const habits = await Storage.getHabits();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    document.getElementById('editHabitId').value = habit.id;
    document.getElementById('editHabitName').value = habit.name;
    document.getElementById('editHabitType').value = habit.type;
    document.getElementById('editHabitTarget').value = habit.target || 1;

    const targetGroup = document.getElementById('editTargetGroup');
    const hint = document.getElementById('editHabitTypeHint');
    const isCount = habit.type === 'count';
    targetGroup.style.display = isCount ? 'block' : 'none';
    hint.textContent = isCount
      ? 'set a daily goal to reach'
      : 'check off when completed';

    this.openModal('editHabitModal');
  },

  // Show keyboard shortcuts help
  showKeyboardShortcutsHelp() {
    if (typeof Toast !== 'undefined') {
      Toast.info('shortcuts: 1-5 toggle habits, j/k navigate, n new habit, esc close');
    }
  },

  // Save edited habit
  async saveEditedHabit() {
    const habitId = document.getElementById('editHabitId').value;
    const name = document.getElementById('editHabitName').value.trim();
    const type = document.getElementById('editHabitType').value;
    const target = parseInt(document.getElementById('editHabitTarget').value) || 1;

    if (!name) {
      Toast.error('habit name is required');
      return;
    }

    const habits = await Storage.getHabits();
    const habitIndex = habits.findIndex(h => h.id === habitId);
    if (habitIndex === -1) {
      Toast.error('habit not found');
      return;
    }

    const updatedHabit = {
      ...habits[habitIndex],
      name: name,
      type: type,
      target: type === 'binary' ? 1 : Math.max(1, target)
    };

    try {
      await Storage.saveHabit(updatedHabit);

      this.closeModal('editHabitModal');
      document.getElementById('editHabitForm').reset();

      await this.renderHabits();
      await this.updateHabitCounter();
      Toast.success('habit updated');
    } catch (error) {
      Toast.error('failed to update: ' + error.message);
    }
  }
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;

  const modalOpen = document.querySelector('.modal.show');

  if (e.key === 'Escape' && modalOpen) {
    A11y.closeModal(modalOpen);
    return;
  }

  if (modalOpen) return;

  // 1-5 - Toggle habits
  if (e.key >= '1' && e.key <= '5') {
    const habitIndex = parseInt(e.key) - 1;
    const checkboxes = document.querySelectorAll('.habit-checkbox input');
    if (checkboxes[habitIndex]) {
      checkboxes[habitIndex].click();
      e.preventDefault();
    }
    return;
  }

  // j/k - Navigate habits
  if (e.key === 'j' || e.key === 'k') {
    const habitItems = document.querySelectorAll('.habit-item');
    if (habitItems.length === 0) return;

    const focused = document.activeElement.closest('.habit-item');
    let index = focused ? Array.from(habitItems).indexOf(focused) : -1;

    if (e.key === 'j') {
      index = Math.min(index + 1, habitItems.length - 1);
    } else {
      index = Math.max(index - 1, 0);
    }

    const targetItem = habitItems[index];
    const focusable = targetItem.querySelector('input, button');
    if (focusable) {
      focusable.focus();
      e.preventDefault();
    }
    return;
  }

  // Space - Toggle selected habit
  if (e.key === ' ') {
    const focused = document.activeElement;
    if (focused.closest('.habit-item')) {
      const checkbox = focused.closest('.habit-item').querySelector('.habit-checkbox input');
      if (checkbox) {
        checkbox.click();
        e.preventDefault();
      }
    }
    return;
  }

  // n - New habit
  if (e.key === 'n') {
    const addBtn = document.getElementById('addHabitBtn');
    if (addBtn && !addBtn.disabled) {
      addBtn.click();
      e.preventDefault();
    }
    return;
  }

  // ? - Show keyboard shortcuts help
  if (e.key === '?') {
    App.showKeyboardShortcutsHelp();
    e.preventDefault();
    return;
  }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
