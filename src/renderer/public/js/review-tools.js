/* review-tools.js — Review tab thesaurus DATA (WC.Review.THES). The legacy
   Track-Changes engine (the beforeinput interceptor, ins/del DOM metadata,
   accept/reject DOM ops, Review.init), the reviewing/accessibility/thesaurus
   panes, restrict-editing and compare — all of which drove the retired
   WC.Editor DOM — were removed in slice 11; the fork engine owns Track Changes
   on the PM path. Only the built-in thesaurus table remains, read by
   commands.js:921. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;

  // Thesaurus data only — commands.js looks up WC.Review.THES[word]; the [11]
  // survival guard checks both WC.Review and WC.Review.THES.
  const Review = {
    THES: { good: ['great', 'fine', 'excellent', 'superb'], bad: ['poor', 'inferior', 'awful'], big: ['large', 'huge', 'enormous'], small: ['little', 'tiny', 'compact'], happy: ['glad', 'joyful', 'content'], important: ['crucial', 'vital', 'significant'], quick: ['fast', 'rapid', 'swift'], said: ['stated', 'noted', 'remarked'] },
  };
  WC.Review = Review;
})();
