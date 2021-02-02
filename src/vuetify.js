import "vuetify/dist/vuetify.css";
import "./vuetify.css";
import "@mdi/font/css/materialdesignicons.css";
import Vue from "vue";
import Vuetify from "vuetify";

Vue.use(Vuetify);

new Vue({
  el: "[data-app]",
  vuetify: new Vuetify(),
  data: () => ({
    date: new Date().toISOString().substr(0, 10),
    menu: false,
  }),
});
