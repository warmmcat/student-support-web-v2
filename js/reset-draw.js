'use strict';

(() => {
  const drawAgainButton = document.querySelector('#draw-again-button');
  const resultCard = document.querySelector('#result-card');
  const drawAnimation = document.querySelector('#draw-animation');
  const questionInput = document.querySelector('#draw-question');
  const questionField = document.querySelector('.question-field');

  if (!drawAgainButton || !resultCard || !questionInput) return;

  function resetForNewQuestion(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    resultCard.hidden = true;
    if (drawAnimation) drawAnimation.hidden = true;

    questionInput.value = '';
    questionInput.dispatchEvent(new Event('input', { bubbles: true }));

    window.requestAnimationFrame(() => {
      (questionField || questionInput).scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => questionInput.focus({ preventScroll: true }), 350);
    });
  }

  drawAgainButton.addEventListener('click', resetForNewQuestion, { capture: true });
})();
