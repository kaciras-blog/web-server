const https = require("https");
const axios = require("axios");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
axios.get("https://localhost:26480/accounts/2").then(res => console.log(res.data));
