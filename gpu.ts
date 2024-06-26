import Z80 from "./Z80";

type GPU = {
  _vram: number[];
  _oam: number[];
  _tileset: number[][][],
  _scrn: {}
  _canvas: {
    putImageData: (scrn: any, arg1: number, arg2: number) => void;
  }
  reset: () => void;
  renderScan: () => void;
  updatetile: (addr: number, value: number) => void;
  _mode: number;
  _modeclock: number;
  _line: number;
  step: () => void;
}
const GPU: GPU = {
    _vram: [0],
    _oam: [0],
    _tileset: [[]],
    _scrn: {},
    _canvas: {
        putImageData: function(scrn) {
          console.log("Pushing screen to canvas.")
          console.log(scrn);
        }
      },

    reset: function() {
        for( let i=0; i<8192; i++ ) {
            GPU._vram[i] = 0;
        }
        for( let i=0; i<160; i++ ) {
            GPU._oam[i] = 0;
        }

        GPU._tileset = [];
        for ( let i=0; i<384; i++ ) {
            GPU._tileset[i] = [];
            for( let j=0; j<8; j++ ) {
                GPU._tileset[i][j] = [0,0,0,0,0,0,0,0]
            }
        }
        /*
        console.log("init canvas");
      let c = document.querySelector("#screen");
      if (c && c.getContext) {
        GPU._canvas = c.getContext('2d');
        if (GPU._canvas) {
          if(GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(160, 144);
          else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 160, 144);
          else GPU._scrn = { 'width': 160, 'height': 144, 'data': new Array(160*144*4) };
          
          //initialize canvas to white
          for( i=0; i< 160*44*4; i++ ) GPU._scrn.data[i] = 255;
        }
      }
        */
    },

    renderScan: function() {},  
    updatetile: function(addr, value){
        let saddr = addr & 0x7FFF;
        // VRAM starts at 0x8000, odd ADDR means its the second byte of the 16-bit word
        // N&1 returns 1 for odd numbers
        if(addr&1) { saddr--; addr--; }
        else { return; } // if writing first byte of word skip updating tiles
        // get base address
        addr = addr & 0x7FFF;

        //which tile and row was updated
        let tile = (addr >> 4) & 511;
        let y = (addr >> 1) & 7;

        let sx;
        for(let x=0; x<8; x++) {
          //find bit index for this pixel
          sx = 1 << (7-x);

          // update tile set
          GPU._tileset[tile][y][x] = ((GPU._vram[addr] & sx) ? 1 : 0) + ((GPU._vram[addr+1] & sx) ? 2 : 0);
        }
        debugger;

    },
  
    _mode: 0,
    _modeclock: 0,
    _line: 0,
    step: function() {
      if(Z80) GPU._modeclock += Z80._r.t;
      console.log(`GPU step. Current modeclock ${GPU._modeclock}`);
  
      switch(GPU._mode) {
            // OAM read mode, scanline active
            case 2:
                if(GPU._modeclock >= 80) {
                  // Enter scanline mode 3
                  GPU._modeclock = 0;
                  GPU._mode = 3;
                }
            break;
            
            // VRAM read mode, scanline active
            // Treat end of mode 3 as end of scanline
            case 3:
            if(GPU._modeclock >= 172) {
              // Enter hblank
              GPU._modeclock = 0;
              GPU._mode = 0;
            
              // Write a scanline to the framebuffer
              GPU.renderScan();
            }
            break;
        // Hblank
        // After the last hblank, push the screen data to canvas
        case 0: 
          if(GPU._modeclock >= 204) {
            GPU._modeclock = 0;
            GPU._line++;
            if(GPU._line == 143) {
              // Enter vblank
              GPU._mode = 1;
              GPU._canvas.putImageData(GPU._scrn, 0, 0);
            } else {
              GPU._mode = 2;
            }
          }
        break;
  
        // vblank (10 lines)
        case 1:
          if(GPU._modeclock >= 456) {
            GPU._modeclock = 0;
            GPU._line++;
  
            if(GPU._line > 153) {
              // Restart scanning modes
              GPU._mode = 2;
              GPU._line = 0;
            }
          }
        break;
      }
    },
}

GPU.reset();

export default GPU;