!function(){"use strict";var e=document.querySelector(".js-toggle"),t=document.querySelector(".js-details"),o=function(){e.removeEventListener("click",n,!1),e.parentNode.removeChild(e),t.classList.remove("is-invisible"),t.removeEventListener("focus",o,!1)},n=function(){t.focus()};t&&e&&(t.setAttribute("tabindex",-1),e.addEventListener("click",n,!1),t.addEventListener("focus",o,!1))}(),function(){if(-1===["localhost","localhost:4567"].indexOf(window.location.host)){WebFontConfig={google:{families:["Open+Sans:400,700","Merriweather"]}};var e=document.createElement("script"),t=document.getElementsByTagName("script")[0];e.src=("https:"==document.location.protocol?"https":"http")+"://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js",e.type="text/javascript",e.async="true",t.parentNode.insertBefore(e,t)}}();