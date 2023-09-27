import "./index.css";
import "focus-visible";

// TODO: Beautify
!(function () {
  "use strict";
  var e = document.querySelector(".js-toggle"),
    t = document.querySelector(".js-details"),
    o = t && t.querySelectorAll("a"),
    n = function () {
      e.removeEventListener("click", i, !1),
        setTimeout(function () {
          e.parentNode.removeChild(e);
        }, 100),
        t.classList.remove("is-invisible"),
        t.removeEventListener("focus", n, !1),
        [].forEach.call(o, function (e) {
          e.setAttribute("tabindex", 0);
        });
    },
    i = function () {
      t.focus();
    };
  t &&
    e &&
    (t.setAttribute("tabindex", -1),
    [].forEach.call(o, function (e) {
      e.setAttribute("tabindex", -1);
    }),
    e.addEventListener("click", i, !1),
    t.addEventListener("focus", n, !1));
})();
