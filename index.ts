import Z80, { dispatcher as startCPU } from "./Z80";
import MMU from "./mmu";

function runInstructions() {
    //Setup
    Z80.reset();
  
    const SUM_AND_CMPR_ROM = [ 
      // Adds 3 and 7 and then compares the result to 5. Expected register A: 5
      0x03, 0x0C, 0x00, // LDAmm
      0x06, 0x0D, 0x00, // LDEmm
      0x08,             // ADDr_e
      0x04, 0x0E, 0x00, // LDBmm
      0x0A,             // CPr_b
      0x09,             // HALT
      0x03, 0x07, 0x05, 0x00 // STORAGE
    ];
  
    const BIOS = [
      0x07, 0xFE, 0xFF, 0x0D, 0x0E, 0x05, 0x08, 0x09
    ];
    // MMU._bios = BIOS; //override with custom BIOS
  
    const USE_STACK_ROM = [
      0x04, 0x0C, 0x00, // LDBmm
      0x05, 0x0D, 0x00, // LDCmm
      0x07, 0x11, 0x00, // LDSPnn 
      0x0B,             // PUSHBC
      0x0C,             // POPHL
      0x09,             // HALT
      0x0E, 0x03, 0x00, // ADDR 0x0C - 0x0E
      0x00, 0x00, 0x00  // STACK 0x0F - 0x11
    ];
  
    const WRITE_VRAM_ROM = [
      0x21, 0x8D, 0x4D, // 0x21 LDHLnn / load 16-bit inmediate into HL
      0x0D, 0x00, 0x80,  // LDmmHL / load HL into 16-bit inmediate addr
      0x76,             // HALT
    ];
    MMU.load(WRITE_VRAM_ROM);
    MMU._bios[255] = 0x00; // NOP last instruction on BIOS, PC already jumped to exec 256

    startCPU();
  }

  runInstructions();

