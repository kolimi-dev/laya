/**
 * Laya (లయ) — Central DOM Element Registry
 */

export function getDomElements() {
  return {
    dateText: document.getElementById('operational-date-text'),
    networkBadge: document.getElementById('network-badge'),

    btnViewTasks: document.getElementById('btn-view-tasks'),
    btnViewCharts: document.getElementById('btn-view-charts'),
    sectionTasksView: document.getElementById('section-tasks-view'),
    sectionChartsView: document.getElementById('section-charts-view'),
    badgeRemainingCount: document.getElementById('badge-remaining-count'),
    badgeChartsCount: document.getElementById('badge-charts-count'),

    groupTabsContainer: document.getElementById('group-tabs-container'),
    feedRemaining: document.getElementById('feed-remaining'),
    feedCompleted: document.getElementById('feed-completed'),
    headerRemainingCount: document.getElementById('header-remaining-count'),
    headerCompletedCount: document.getElementById('header-completed-count'),

    timeFilterButtons: document.getElementById('time-filter-buttons'),
    customDateInputs: document.getElementById('custom-date-inputs'),
    chartDateFrom: document.getElementById('chart-date-from'),
    chartDateTo: document.getElementById('chart-date-to'),
    btnApplyCustomDate: document.getElementById('btn-apply-custom-date'),
    btnOpenAddChart: document.getElementById('btn-open-add-chart'),
    taskChartsGrid: document.getElementById('task-charts-grid'),

    modalTask: document.getElementById('modal-task-backdrop'),
    taskGroupSelect: document.getElementById('task-group-select'),
    taskTypeSelect: document.getElementById('task-type-select'),
    milestonesGroup: document.getElementById('milestones-input-group'),
    percentageGroup: document.getElementById('percentage-input-group'),
    recurrenceSelect: document.getElementById('task-recurrence-select'),
    cycleDaysGroup: document.getElementById('cycle-days-group'),
    milestonesBuilderList: document.getElementById('milestones-builder-list'),
    daysPickerPills: document.getElementById('days-picker-pills'),

    modalGroup: document.getElementById('modal-group-backdrop'),
    modalCapabilities: document.getElementById('modal-capabilities-backdrop'),
    modalOnboarding: document.getElementById('modal-onboarding-backdrop'),
    modalSponsor: document.getElementById('modal-sponsor-backdrop'),
    modalFeedback: document.getElementById('modal-feedback-backdrop'),
    modalData: document.getElementById('modal-data-backdrop'),
    modalOtp: document.getElementById('modal-otp-backdrop'),

    modalAddChart: document.getElementById('modal-add-chart-backdrop'),
    selectChartTask: document.getElementById('select-chart-task'),
    selectChartType: document.getElementById('select-chart-type'),
    formAddChart: document.getElementById('form-add-chart'),

    otpExpectedCode: document.getElementById('otp-expected-code'),
    otpInputField: document.getElementById('otp-input-field'),
    btnConfirmPurge: document.getElementById('btn-confirm-purge'),
    otpErrorMsg: document.getElementById('otp-error-msg'),

    toggleFeatMilestones: document.getElementById('toggle-feat-milestones'),
    toggleFeatQuantified: document.getElementById('toggle-feat-quantified'),
    toggleFeatRadialDial: document.getElementById('toggle-feat-radial-dial'),
    toggleFeatMicronotes: document.getElementById('toggle-feat-micronotes'),
    toggleFeatSchedules: document.getElementById('toggle-feat-schedules'),
  };
}
