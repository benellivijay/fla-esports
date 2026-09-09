"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));
console.log(`\n🚀 Running all ${files.length} test suites...\n`);
let totalPassedSuites = 0;
for (const file of files) {
    console.log(`\n========================================`);
    console.log(`▶ Running Suite: ${file}`);
    console.log(`========================================`);
    try {
        (0, child_process_1.execSync)(`node "${path.join(testDir, file)}"`, { stdio: 'inherit' });
        totalPassedSuites++;
    }
    catch (error) {
        console.error(`❌ Suite failed: ${file}`);
        process.exit(1);
    }
}
console.log(`\n🎉 ALL ${totalPassedSuites}/${files.length} TEST SUITES PASSED CLEANLY!\n`);
