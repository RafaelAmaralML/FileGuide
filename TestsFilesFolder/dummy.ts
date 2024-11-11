// dummy.ts

import * as fs from 'fs';

interface IHelper {
    helperMethod(): void;
}

// Main function with two parameters
function mainFunction(param1: number, param2: number): number {
    const result: number = param1 / param2;
    return result;
}

class HelperClass implements IHelper {
    public helperMethod(): void {
        console.log("Helper method from HelperClass");
    }
}

export { mainFunction, HelperClass };
