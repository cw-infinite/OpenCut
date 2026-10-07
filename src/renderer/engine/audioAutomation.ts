import type { Animatable } from '../../shared/types';
import { ease } from './keyframes';

// FFmpeg evaluates this in clip-relative output time, after atempo and before range trimming.
export function volumeFilter(animated: Animatable<number>): string {
  const keys = animated.keyframes;
  if (!keys.length) return `volume=${animated.value}`;
  const seconds = (time: number) => (time / 1e6).toFixed(6);
  let expression = String(keys.at(-1)!.value);
  for (let index = keys.length - 2; index >= 0; index--) {
    const left = keys[index], right = keys[index + 1];
    const x = `((t-${seconds(left.time)})/${seconds(right.time - left.time)})`;
    let curve: string;
    switch (left.easing) {
      case 'hold': curve = '0'; break;
      case 'linear': curve = x; break;
      case 'easeIn': curve = `pow(${x},2)`; break;
      case 'easeOut': curve = `(1-pow(1-${x},2))`; break;
      case 'easeInOut': curve = `if(lt(${x},0.5),2*pow(${x},2),1-pow(-2*${x}+2,2)/2)`; break;
      default: {
        // Bounded piecewise approximation of a custom Bezier; ordinary easings are exact.
        curve = '1';
        for (let n = 63; n >= 0; n--) {
          const from = n / 64, to = (n + 1) / 64, a = ease(from, left.easing), b = ease(to, left.easing);
          curve = `if(lt(${x},${to}),${a}+(${b - a})*(${x}-${from})*64,${curve})`;
        }
      }
    }
    const value = `(${left.value}+(${right.value - left.value})*${curve})`;
    expression = `if(lt(t,${seconds(right.time)}),${value},${expression})`;
  }
  expression = `if(isnan(t),${keys[0].value},if(lt(t,${seconds(keys[0].time)}),${keys[0].value},${expression}))`;
  return `volume='${expression}':eval=frame`;
}
