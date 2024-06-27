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
      0x09,             // CPr_b
      0x76,             // HALT
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
      0x0A,             // PUSHBC
      0x0B,             // POPHL
      0x76,             // HALT
      0x0E, 0x03, 0x00, // ADDR 0x0C - 0x0E
      0x00, 0x00, 0x00  // STACK 0x0F - 0x11
    ];
  
    const WRITE_VRAM_ROM = [
      0x21, 0x07, 0x07,   // 0x21 LDHLnn / load 16-bit inmediate into HL
      0x0E, 0x00, 0x80,   // LDmmHL / load HL into 16-bit inmediate addr
      0x21, 0x08, 0x08,   // 0x21 LDHLnn 
      0x0E, 0x02, 0x80,   // LDmmHL 
      0x21, 0x17, 0x10,   // 0x21 LDHLnn 
      0x0D, 0x04, 0x80,   // LDmmHL 
      0x21, 0x24, 0x20,   // 0x21 LDHLnn 
      0x0E, 0x06, 0x80,   // LDmmHL 
      0x21, 0x25, 0x20,   // 0x21 LDHLnn 
      0x0D, 0x08, 0x80,   // LDmmHL 
      0x76,               // HALT
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // MEMORY BANK 0x1F - 0x26
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, //             0x27 - 0x2E
    ];
    const LOAD_SPRITE_AUTO_ROM = [
      0x01, 0x12, 0x00, // LDBCnn / load tileset addr (0x11, 0x00) into BC
      0x21, 0x80, 0x00, // LDHLnn / load VRAM addr (0x00, 0x80) into HL
      0x0A,             // LDA(BC) LDABCm / load lower-byte of tileset into A
      0x03,             // INCBC / move to tile's higher-byte
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x0A,             // LDA(BC) LDABCm / load higher-byte of tile into A
      0x03,             // INCBC / move to next tile's lower-byte
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x0A,             // LDA(BC) LDABCm / load new tile's lower-byte of tile into A
      0x03,             // INCBC / move to new tile's higher-byte
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x0A,             // LDA(BC) LDABCm / load new tile's higher-byte of tile into A
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x76,             // 0x76 HALT
      // ROM DATA BANK
      0x07, 0x07,       // 0x12 - 0x13
      0x08, 0x08,       // 0x14 - 0x15
    ];

    const LOOP_ROM = [
     0x16, 0x04, // 0x16 LDD,n LDrn_d 0x04 / load register D with inmediate 8-bit (counter down)
     0x00,       // 0x00 NOP / instructions to repeat
     0x15,       // 0x15 DECD DECr_d / decrease counter in register D
     0xC2, 0x02, 0x00, // 0xC2 JP NZ,nn JPNZnn 0x04, 0x00 / jump to start of loop if non-zero
     0x76,       // 0x76 HALT
    ];

    const LOAD_SPRITE_AUTO_LOOP_ROM = [
      0x01, 0x15, 0x00, // LDBCnn / load tileset addr (0x15, 0x00) into BC
      0x21, 0x80, 0x00, // LDHLnn / load VRAM addr (0x00, 0x80) into HL
      0x16, 0x02,       // 0x16 LDD,n LDrn_d 0x02 / load r_D with inmediate 8-bit (count)
      // start loop instructions
      0x0A,             // 0x0A LDA(BC) LDABCm / load lower-byte of tileset into A
      0x03,             // 0x03 INCBC / move bytecount to tile's higher-byte addr
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x0A,             // 0x0A LDA(BC)LDABCm / load higher-byte of tileset into A
      0x22,             // 0x022 LDI(HL),A LDHLIA / load A into HL pointed and increase HL
      0x03,             // 0x03 INCBC / move bytecount to next tile's lower-byte addr
      // end loop instructions
      0x15,             // 0x15 DEC D DECr_d / decrease count in register D
      0xC2, 0x08, 0x00, // 0xC2 JP NZ,nn JPNZnn 0x00, 0x00 / jump to start of loop if non-zero
      0x76,             // 0x76 HALT
      // ROM DATA BANK
      0x07, 0x07,       // 0x15 - 0x16
      0x08, 0x08,       // 0x17 - 0x18
    ];

    MMU.load(LOAD_SPRITE_AUTO_LOOP_ROM);
    MMU._bios[255] = 0x00; // NOP last instruction on BIOS, PC already jumped to exec 256

    startCPU();
  }

  runInstructions();

