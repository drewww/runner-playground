import { BaseTest } from './base-test';
import { LogLevel } from '../matrix-display';
import { TileId } from '../types';

export class PatternAnimationTest extends BaseTest {
    private animatedTiles: TileId[] = [];
    
    constructor(logLevel?: LogLevel) {
        super({
            worldWidth: 40,
            worldHeight: 20,
            viewportWidth: 40,
            viewportHeight: 20,
            cellSize: 24,
            logLevel
        });
    }

    getName(): string {
        return "pattern-animation";
    }

    getDescription(): string {
        return "Tests pattern-based animations";
    }

    protected run(): void {
        // Pattern 1: Binary counter
        const binarySymbols = ['0', '1'];
        const binaryId = this.display.createTile(5, 5, '0', '#00FF00FF', '#000000FF', 1);
        this.display.addSymbolAnimation(binaryId, binarySymbols, 2.0);
        this.animatedTiles.push(binaryId);

        // Pattern 2: Clock animation
        const clockSymbols = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
        const clockId = this.display.createTile(10, 5, '🕐', '#FFFFFFFF', '#000000FF', 1);
        this.display.addSymbolAnimation(clockId, clockSymbols, 12.0);
        this.animatedTiles.push(clockId);

        // Pattern 3: Wave pattern
        const waveSymbols = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'];
        const waveId = this.display.createTile(15, 5, '▁', '#0088FFFF', '#000000FF', 1);
        this.display.addSymbolAnimation(waveId, waveSymbols, 1.0, true);
        this.animatedTiles.push(waveId);

        // Color animation 1: Pulsing red background
        const pulsingId = this.display.createTile(5, 10, '♥', '#FFFFFFFF', '#FF000088', 1);
        this.display.addColorAnimation(pulsingId, {
            bg: {
                start: '#FF000088',
                end: '#FF0000FF',
                duration: 2.0,
                reverse: true,
                offset: 0
            }
        });
        this.animatedTiles.push(pulsingId);

        // Color animation 2: Rainbow text
        const rainbowId = this.display.createTile(10, 10, '★', '#FF0000FF', '#000000FF', 1);
        this.display.addColorAnimation(rainbowId, {
            fg: {
                start: '#FF0000FF',
                end: '#00FF00FF',
                duration: 3.0,
                reverse: true,
                offset: 0
            }
        });
        this.animatedTiles.push(rainbowId);

        // Color animation 3: Combined fg/bg with offset
        for (let i = 0; i < 5; i++) {
            const waveTileId = this.display.createTile(15 + i, 10, '◆', '#FFFFFFFF', '#0000FFFF', 1);
            this.display.addColorAnimation(waveTileId, {
                fg: {
                    start: '#FFFFFFFF',
                    end: '#00FFFFFF',
                    duration: 1.5,
                    reverse: true,
                    offset: i * 0.2
                },
                bg: {
                    start: '#0000FFFF',
                    end: '#000000FF',
                    duration: 1.5,
                    reverse: true,
                    offset: i * 0.2
                }
            });
            this.animatedTiles.push(waveTileId);
        }

        // Color animation 4: Wide wave with shared start time
        const sharedStartTime = performance.now();
        for (let i = 0; i < this.display.getWorldWidth(); i++) {
            const wideTileId = this.display.createTile(i, 15, '▀', '#FFFFFFFF', '#000000FF', 1);
            this.display.addColorAnimation(wideTileId, {
                fg: {
                    start: '#FF0000FF',
                    end: '#0000FFFF',
                    duration: 2.0,
                    reverse: true,
                    offset: i * 0.02  // Smaller offset for smoother wave
                },
                startTime: sharedStartTime
            });
            this.animatedTiles.push(wideTileId);
        }

        // Background fill animation
        const fillId = this.display.createTile(25, 5, 'X', '#FFFFFFFF', '#FF0000FF', 1, 0);
        this.display.addValueAnimation(fillId, {
            bgPercent: {
                start: 0,
                end: 1,
                duration: 2.0,
                reverse: true,
                offset: 0
            }
        });
        this.animatedTiles.push(fillId);

        // Background fill wave animation
        const sharedFillStartTime = performance.now();
        for (let i = 0; i < 10; i++) {  // Create 10 tiles in a row
            const waveFillId = this.display.createTile(25 + i, 10, 'S', '#FFFFFFFF', '#0088FFFF', 1, 0);
            this.display.addValueAnimation(waveFillId, {
                bgPercent: {
                    start: 0,
                    end: 1,
                    duration: 1.5,
                    reverse: true,
                    offset: i * 0.15  // Each tile starts slightly after the previous one
                },
                startTime: sharedFillStartTime
            });
            this.animatedTiles.push(waveFillId);
        }

        // Vertical stacked progress bar (x = 35, y = 2-6)
        const barHeight = 5;
        for (let i = 0; i < barHeight; i++) {
            const tileId = this.display.createTile(35, 6 - i, ' ', '#FFFFFFFF', '#00FF00FF', 1, 0);
            this.display.addValueAnimation(tileId, {
                bgPercent: {
                    start: 0,
                    end: 1,
                    duration: 4.0,
                    reverse: true,
                    // Each tile starts when the one below is almost full
                    offset: (barHeight - 1 - i) * 0.2
                }
            });
            this.animatedTiles.push(tileId);
        }

        // ASCII spinner with easing (x = 35, y = 8)
        const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        const spinnerId = this.display.createTile(35, 8, spinnerFrames[0], '#00FF00FF', '#000000FF', 1);
        this.display.addSymbolAnimation(spinnerId, spinnerFrames, 1.0);
        // Add pulsing color with sine easing
        this.display.addColorAnimation(spinnerId, {
            fg: {
                start: '#00FF00FF',
                end: '#00FF0044',
                duration: 2.0,
                reverse: true,
                offset: 0.25  // Quarter phase offset for smooth sine wave
            }
        });
        this.animatedTiles.push(spinnerId);

        // Multi-character progress bar (x = 2-12, y = 18)
        const progressChars = ['[          ]', '[=         ]', '[==        ]', '[===       ]',
                              '[====      ]', '[=====     ]', '[======    ]', '[=======   ]',
                              '[========  ]', '[========= ]', '[==========]'];
        for (let i = 0; i < progressChars[0].length; i++) {
            const charId = this.display.createTile(2 + i, 18, progressChars[0][i], '#00FF00FF', '#000000FF', 1);
            this.display.addSymbolAnimation(charId, progressChars.map(frame => frame[i]), 2.0, true);
            this.animatedTiles.push(charId);
        }

        // Rainbow wave with cubic easing (x = 15-25, y = 18)
        const waveWidth = 10;
        const colors = ['#FF0000FF', '#FF7F00FF', '#FFFF00FF', '#00FF00FF', '#0000FFFF', '#4B0082FF', '#8F00FFFF'];
        for (let i = 0; i < waveWidth; i++) {
            const waveTileId = this.display.createTile(15 + i, 18, '■', colors[0], '#000000FF', 1);
            // Cubic easing function: t³
            const offset = Math.pow(i / waveWidth, 3);
            this.display.addColorAnimation(waveTileId, {
                fg: {
                    start: colors[0],
                    end: colors[colors.length - 1],
                    duration: 3.0,
                    reverse: true,
                    offset
                }
            });
            this.animatedTiles.push(waveTileId);
        }

        // Matrix-style falling characters (x = 38, y = 2-7)
        const matrixChars = '日月火水木金土'.split('');
        for (let y = 2; y < 8; y++) {
            const charId = this.display.createTile(38, y, matrixChars[0], '#00FF00FF', '#000000FF', 1);
            this.display.addSymbolAnimation(charId, matrixChars, 0.5);
            this.display.addColorAnimation(charId, {
                fg: {
                    start: '#00FF00FF',
                    end: '#00FF0044',
                    duration: 1.0,
                    reverse: true,
                    offset: y * 0.15  // Cascade effect
                }
            });
            this.animatedTiles.push(charId);
        }

        // Bouncing dot with quadratic easing (x = 28-32, y = 18)
        const bounceWidth = 5;
        for (let i = 0; i < bounceWidth; i++) {
            const bounceId = this.display.createTile(28 + i, 18, '•', '#FFFFFFFF', '#000000FF', 1);
            // Quadratic easing: t²
            const offset = Math.pow(i / bounceWidth, 2);
            this.display.addColorAnimation(bounceId, {
                fg: {
                    start: '#FFFFFFFF',
                    end: '#FFFFFF44',
                    duration: 1.5,
                    reverse: true,
                    offset
                }
            });
            this.animatedTiles.push(bounceId);
        }
    }

    protected cleanup(): void {
        this.animatedTiles.forEach(id => this.display.removeTile(id));
        this.animatedTiles = [];
    }
} 