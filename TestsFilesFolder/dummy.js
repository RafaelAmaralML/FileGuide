// dummy.js

const fs = require('fs');

// A sample JavaScript function
function mainFunction(param1, param2) {
    const result = param1 * param2;
    return result;
}

class HelperClass {
    constructor() {
        console.log("HelperClass initialized");
    }
    
    helperMethod() {
        console.log("Helper method executed");
    }
}

module.exports = { mainFunction, HelperClass };
