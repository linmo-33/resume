declare module 'mark.js' {
  interface MarkOptions {
    element?: string;
    className?: string;
    exclude?: string[];
    separateWordSearch?: boolean;
    accuracy?: 'partially' | 'complementary' | 'exactly';
    diacritics?: boolean;
    synonyms?: Record<string, string>;
    iframes?: boolean;
    iframesTimeout?: number;
    acrossElements?: boolean;
    caseSensitive?: boolean;
    ignoreJoiners?: boolean;
    ignorePunctuation?: string[];
    wildcards?: 'disabled' | 'enabled' | 'withSpaces';
    each?: (element: HTMLElement) => void;
    noMatch?: () => void;
    filter?: (node: HTMLElement, term: string, totalCounter: number, counter: number) => boolean;
    done?: (totalMarks: number) => void;
    debug?: boolean;
    log?: any;
  }

  class Mark {
    constructor(context: HTMLElement | HTMLElement[] | NodeList | string);
    mark(keyword: string | string[], options?: MarkOptions): void;
    markRanges(ranges: Array<{ start: number; length: number }>, options?: MarkOptions): void;
    markRegExp(regexp: RegExp, options?: MarkOptions): void;
    unmark(options?: { element?: string; className?: string; exclude?: string[]; done?: () => void }): void;
  }

  export = Mark;
} 