(function ($) {
  "use strict";

  var TOTAL_FIELDS = 6;
  var currentStep = 0;
  var screen0Advanced = false;
  var thankModalDismissed = false;

  var $slides = $("#slides");
  var $progressFill = $("#progressFill");
  var $progressValue = $("#progressValue");
  var $progress = $(".progress");
  var $thankModal = $("#thankYouModal");
  var $dots = $("#stepDots").find(".step-dots__dot");

  function getTextScore($input) {
    return ($input.val() || "").trim().length >= 3;
  }

  function textPartialWeight($input) {
    var len = ($input.val() || "").trim().length;
    if (len <= 0) return 0;
    if (len >= 3) return 1;
    return len / 3;
  }

  function getSelectScore($wrap) {
    var v = $wrap.find('input[type="hidden"]').val();
    return typeof v === "string" && v.length > 0;
  }

  function getRadioScore(name) {
    return $('input[name="' + name + '"]:checked').length > 0;
  }

  function fieldStates() {
    return {
      textFirst: getTextScore($("#textFirst")),
      textCity: getTextScore($("#textCity")),
      selectRole: getSelectScore($('.custom-select[data-field="selectRole"]')),
      selectFocus: getSelectScore($('.custom-select[data-field="selectFocus"]')),
      radioTempo: getRadioScore("radioTempo"),
      radioFeedback: getRadioScore("radioFeedback"),
    };
  }

  function completionCount() {
    var s = fieldStates();
    var n = 0;
    Object.keys(s).forEach(function (k) {
      if (s[k]) n += 1;
    });
    return n;
  }

  function step0Complete() {
    var s = fieldStates();
    return s.textFirst && s.textCity && s.selectRole;
  }

  function visualProgressPercent() {
    var slice = 100 / TOTAL_FIELDS;
    var p = 0;
    p += slice * textPartialWeight($("#textFirst"));
    p += slice * textPartialWeight($("#textCity"));
    p += slice * (getSelectScore($('.custom-select[data-field="selectRole"]')) ? 1 : 0);
    p += slice * (getSelectScore($('.custom-select[data-field="selectFocus"]')) ? 1 : 0);
    p += slice * (getRadioScore("radioTempo") ? 1 : 0);
    p += slice * (getRadioScore("radioFeedback") ? 1 : 0);
    return Math.min(100, p);
  }

  var progressSmooth = 0;
  var progressTarget = 0;
  var progressRafId = null;
  var progressLastTs = 0;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function applyProgressVisual(p) {
    var clamped = Math.min(100, Math.max(0, p));
    $progressFill.css("width", clamped + "%");
    $progressValue.text(Math.round(clamped) + "%");
    $progress.attr("aria-valuenow", String(Math.round(clamped)));
  }

  function stepProgressSmooth(ts) {
    if (prefersReducedMotion()) {
      progressSmooth = progressTarget;
      applyProgressVisual(progressSmooth);
      progressRafId = null;
      progressLastTs = 0;
      return;
    }
    var dt = progressLastTs ? Math.min(40, ts - progressLastTs) : 16.67;
    progressLastTs = ts;
    var diff = progressTarget - progressSmooth;
    if (Math.abs(diff) < 0.015) {
      progressSmooth = progressTarget;
      applyProgressVisual(progressSmooth);
      progressRafId = null;
      progressLastTs = 0;
      return;
    }
    var t = Math.min(1, dt / 16.67);
    var k = 0.028 + 0.072 * t;
    progressSmooth += diff * k;
    applyProgressVisual(progressSmooth);
    progressRafId = window.requestAnimationFrame(stepProgressSmooth);
  }

  function scheduleProgressSmooth() {
    progressTarget = visualProgressPercent();
    if (prefersReducedMotion()) {
      progressSmooth = progressTarget;
      applyProgressVisual(progressSmooth);
      return;
    }
    if (Math.abs(progressTarget - progressSmooth) < 0.015) {
      progressSmooth = progressTarget;
      applyProgressVisual(progressSmooth);
      return;
    }
    if (progressRafId === null) {
      progressLastTs = 0;
      progressRafId = window.requestAnimationFrame(stepProgressSmooth);
    }
  }

  function updateProgressUI() {
    var done = completionCount();
    scheduleProgressSmooth();

    if (done === TOTAL_FIELDS) {
      if (!thankModalDismissed) {
        $thankModal.removeAttr("hidden");
        $("body").addClass("modal-open");
        setTimeout(function () {
      location.reload();
    }, 5000);
      }
    } else {
      thankModalDismissed = false;
      $thankModal.attr("hidden", "hidden");
      $("body").removeClass("modal-open");
    }
    
  }

  function setSlideAria(step) {
    $(".slide").each(function () {
      var $el = $(this);
      var isCurrent = Number($el.data("step")) === step;
      $el.attr("aria-hidden", isCurrent ? "false" : "true");
    });
  }

  function goToStep(step) {
    if (step < 0 || step > 1) return;
    currentStep = step;
    if (step === 0) {
      $slides.removeClass("is-step-1");
    } else {
      $slides.addClass("is-step-1");
    }
    setSlideAria(step);
    $dots.removeClass("is-active").eq(step).addClass("is-active");
    toggleBackBtn();
  }

  function onAnyChange() {
    updateProgressUI();

    if (currentStep === 0 && !screen0Advanced && step0Complete()) {
      screen0Advanced = true;
      goToStep(1);
      window.setTimeout(function () {
        $('.slide[data-step="1"] .custom-select__trigger').first().trigger("focus");
      }, 420);
    }
  }

 
  $("#textFirst, #textCity").on("input", function () {
    var $t = $(this);
    var ok = getTextScore($t);
    $t.toggleClass("is-invalid", $t.val().length > 0 && !ok);
    onAnyChange();
  });

  
  $('input[name="radioTempo"], input[name="radioFeedback"]').on("change", onAnyChange);

  function closeAllSelects(except$) {
    $(".custom-select").each(function () {
      var $w = $(this);
      if (except$ && $w[0] === except$[0]) return;
      $w.removeClass("is-open");
      $w.find(".custom-select__trigger").attr("aria-expanded", "false");
      $w.find(".custom-select__panel").attr("hidden", "hidden");
      $w.find(".custom-select__option").removeClass("is-highlighted");
    });
  }

  function setSelectValue($wrap, value, label) {
    var $hidden = $wrap.find('input[type="hidden"]');
    var $val = $wrap.find(".custom-select__value");
    $hidden.val(value);
    $val.text(label);
    $val.toggleClass("is-placeholder", !value);
    $wrap.find(".custom-select__option").removeClass("is-selected");
    $wrap.find('.custom-select__option[data-value="' + value + '"]').addClass("is-selected");
  }

  $(".custom-select__trigger").on("click", function (e) {
    e.stopPropagation();
    var $wrap = $(this).closest(".custom-select");
    var isOpen = $wrap.hasClass("is-open");
    closeAllSelects();
    if (!isOpen) {
      $wrap.addClass("is-open");
      $(this).attr("aria-expanded", "true");
      $wrap.find(".custom-select__panel").removeAttr("hidden");
    } else {
      $wrap.removeClass("is-open");
      $(this).attr("aria-expanded", "false");
      $wrap.find(".custom-select__panel").attr("hidden", "hidden");
    }
  });

  $(".custom-select__option").on("mousedown", function (e) {
    e.preventDefault();
  });

  $(".custom-select__option").on("click", function () {
    var $opt = $(this);
    var $wrap = $opt.closest(".custom-select");
    var value = $opt.data("value");
    var label = $opt.text();
    setSelectValue($wrap, value, label);
    $wrap.removeClass("is-open");
    $wrap.find(".custom-select__trigger").attr("aria-expanded", "false");
    $wrap.find(".custom-select__panel").attr("hidden", "hidden");
    onAnyChange();
  });

  $(document).on("click", function () {
    closeAllSelects();
  });

  $(".custom-select").on("click", function (e) {
    e.stopPropagation();
  });

  
  $(".custom-select__trigger").on("keydown", function (e) {
    var key = e.key;
    var $wrap = $(this).closest(".custom-select");
    var $panel = $wrap.find(".custom-select__panel");
    var $opts = $wrap.find(".custom-select__option");

    if (key === "Escape") {
      closeAllSelects();
      return;
    }

    if (key === "Enter" || key === " ") {
      e.preventDefault();
      $(this).trigger("click");
      return;
    }

    if (!$wrap.hasClass("is-open")) return;

    if (key === "ArrowDown" || key === "ArrowUp") {
      e.preventDefault();
      var $hl = $opts.filter(".is-highlighted").first();
      var idx = $hl.length ? $opts.index($hl) : -1;
      if (key === "ArrowDown") idx = Math.min(idx + 1, $opts.length - 1);
      else idx = Math.max(idx - 1, 0);
      $opts.removeClass("is-highlighted");
      $opts.eq(idx).addClass("is-highlighted");
    }

    if (key === "Enter" && $wrap.hasClass("is-open")) {
      var $t = $opts.filter(".is-highlighted").first();
      if ($t.length) $t.trigger("click");
    }
  });

  
  $(".custom-select__value").each(function () {
    var ph = $(this).data("placeholder");
    if (ph && !$(this).closest(".custom-select").find('input[type="hidden"]').val()) {
      $(this).addClass("is-placeholder");
    }
  });

  function closeThankModal() {
    if (completionCount() === TOTAL_FIELDS) {
      thankModalDismissed = true;
    }
    $thankModal.attr("hidden", "hidden");
    $("body").removeClass("modal-open");
  }

  $("[data-close-modal]").on("click", closeThankModal);

  $(document).on("keydown", function (e) {
    if (e.key === "Escape" && !$thankModal.is("[hidden]")) {
      closeThankModal();
    }
  });
  function toggleBackBtn() {
  if (currentStep === 0) {
    $("#backBtn").addClass("is-hidden");
  } else {
    $("#backBtn").removeClass("is-hidden");
  }
}
  
$("#backBtn").on("click", function () {
  if (currentStep > 0) {
    currentStep = 0; 
    screen0Advanced = false; 
    goToStep(currentStep);
  }
});

  updateProgressUI();
  setSlideAria(0);
  toggleBackBtn();
})(jQuery);
