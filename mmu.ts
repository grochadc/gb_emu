import Z80 from "./Z80";
import GPU from "./gpu";

type MMU = {
  _inbios: number;
  _bios: number[];
  _rom: number[];
  load: (instructions: number[]) => void;
  rb: (addr: number) => number;
  rw: (addr: number) => number;
  wb: (addr: number, value: number) => void;
  ww: (addr: number, value: number) => void;
}
const MMU: MMU = {
    _inbios: 1,
    
    //Memory Regions
    _bios: [0xC3, 0xFF, 0x00],
    _rom: [],
    load: function(instructions){
      MMU._rom = instructions;
    },  
    rb: function(addr) { /* Read 8-bit byte from address */
      switch(addr & 0xF000) { // & 0xF000 // Why bitwise addr with 0xF000?
        //BIOS (256b)/ROM0
        case 0x0000:
          if(MMU._inbios) { 
            if(addr < 0x0100) return MMU._bios[addr];
            else if(Z80?._r.pc >= 0x0100) {
              MMU._inbios = 0;
              console.log("Leaving BIOS");
            };
          }
          // Loading from ROM0 Out of BIOS
          return MMU._rom[addr % 256];
        // ROM0
        case 0x1000:
        case 0x2000:
        case 0x3000:
          const ad = addr % 256;
          return MMU._rom[ad]; // MMU._rom.charCodeAt(addr); Original implementation
          
        // ROM1 (16k)
        case 0x4000:
        case 0x5000:
        case 0x6000:
        case 0x7000:
          return MMU._rom[addr];
        
        // Graphics VRAM (8k)
        case 0x8000:
        case 0x9000:
          return GPU._vram[addr & 0x1FFF];
        default:
          throw new Error("Couldn't find memoery address");
      }
    },
    rw: function(addr) { 
      /* Read 16-bit word from address */
      return MMU.rb(addr) + (MMU.rb(addr+1) << 8);
    },
    wb: function(addr, value) { 
      /* Write 8-bit byte to address */
      switch(addr & 0xF000) {
        case 0x0000:
            if(MMU._inbios) MMU._bios[addr] = value;
            else MMU._rom[addr] = value;
        break;

        case 0x8000:
        case 0x9000:
          GPU._vram[addr & 0x7FFF] = value;
          GPU.updatetile(addr, value);
        break;
        default: throw new Error(`Couldn't locate address ${addr}`);
      }
    },
    ww: function(addr, value) { 
      /* Write a 16-bit word to address */
      MMU.wb(addr,value&255); MMU.wb(addr+1,value>>8);}
  }

export default MMU;