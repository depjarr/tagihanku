import { Injectable } from '@nestjs/common';
import { calculateSplit, SplitInput, SplitResult } from './split.calculator';

@Injectable()
export class SplitService {
  calculate(input: SplitInput): SplitResult {
    return calculateSplit(input);
  }
}
