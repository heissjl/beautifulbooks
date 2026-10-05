import { describe, expect, it } from 'vitest';
import { cleanAuthor, cleanBook, primaryAuthor } from '../calibre/clean';

const q = (title: string, authors: string[], isbns: string[] = []) => cleanBook({ title, authors, isbns });

describe('cleanAuthor', () => {
  it('turns "Surname, Given" around', () => {
    expect(cleanAuthor('Dick, Philip K.')).toBe('Philip K. Dick');
    expect(cleanAuthor('Lem, Stanisław')).toBe('Stanisław Lem');
  });

  it('leaves a name that is already in order', () => {
    expect(cleanAuthor('Kim Stanley Robinson')).toBe('Kim Stanley Robinson');
    expect(cleanAuthor('qntm')).toBe('qntm');
  });

  it('takes the first of two people in one field', () => {
    expect(cleanAuthor('Thomas C. Reed, Danny B. Stillman')).toBe('Thomas C. Reed');
    expect(cleanAuthor('Strugatzki, Arkadij u. Boris')).toBe('Arkadij Strugatzki');
  });

  it('drops credentials, life dates, stray punctuation and a file name', () => {
    expect(cleanAuthor('Preston, Psy.D., ABPP, John D.')).toBe('John D. Preston');
    expect(cleanAuthor('Cassidy, David Charles, 1945-')).toBe('David Charles Cassidy');
    expect(cleanAuthor('Carlo Rovelli;')).toBe('Carlo Rovelli');
    expect(cleanAuthor('Packer, George.epub A 10fd655d6e0648670bb16bcce15d1edf')).toBe('George Packer');
  });

  it('knows nobody', () => {
    expect(cleanAuthor('Unknown')).toBe('');
    expect(cleanAuthor('()')).toBe('');
    expect(primaryAuthor(['Unknown', 'Adams, Douglas'])).toBe('Douglas Adams');
  });
});

describe('cleanBook', () => {
  it('leaves a plain book alone', () => {
    expect(q('Dune', ['Frank Herbert'], ['9780441172719'])).toEqual({ title: 'Dune', author: 'Frank Herbert', isbns: ['9780441172719'] });
  });

  it('drops a series in front', () => {
    expect(q('[Philip K. Dick 04] • Flow My Tears, the Policeman Said', ['Dick, Philip K.'])?.title).toBe('Flow My Tears, the Policeman Said');
    expect(q('Foundation 1 - Foundation', ['Asimov, Isaac'])?.title).toBe('Foundation');
    expect(q('Micky7 01 - Mickey7', ['Edward Ashton'])?.title).toBe('Mickey7');
    expect(q('Hey 3318 – Es ist nicht leicht, ein Gott zu sein', ['Strugatzki, Arkadij u. Boris'])?.title).toBe('Es ist nicht leicht, ein Gott zu sein');
    expect(q('Wayward Pines - 02 Wayward', ['Blake Crouch'])?.title).toBe('Wayward');
  });

  it('drops a year in front and keeps a title that is a year', () => {
    expect(q('1974-Rendezvous With Rama', ['Arthur C. Clarke'])?.title).toBe('Rendezvous With Rama');
    expect(q('1984', ['George Orwell'])?.title).toBe('1984');
    expect(q('2001: A Space Odyssey', ['Arthur C. Clarke'])?.title).toBe('2001');
  });

  it('takes the author out of the title, in front or behind', () => {
    expect(q('Crichton, Michael - Sphere', ['Crichton, Michael'])).toMatchObject({ title: 'Sphere', author: 'Michael Crichton' });
    expect(q('Philip Roth - Everyman', ['Philip Roth'])?.title).toBe('Everyman');
    expect(q('Goldt, Max - Der Krapfen auf dem Sims.indd', ['Max Goldt'])?.title).toBe('Der Krapfen auf dem Sims');
    expect(q('Unwinding_ An Inner History of the New America, The - Packer, George', ['Packer, George.epub A 10fd', 'Packer, George'])).toMatchObject({
      title: 'The Unwinding',
      author: 'George Packer',
    });
  });

  it('finds the author in the title when the field holds the title', () => {
    expect(q('1954 Ray Bradbury - Fahrenheit 451', ['Fahrenheit 451'])).toMatchObject({ title: 'Fahrenheit 451', author: 'Ray Bradbury' });
    expect(q('Wilson, Robert Charles - Spin', ['Spin'])).toMatchObject({ title: 'Spin', author: 'Robert Charles Wilson' });
  });

  it('prefers the brother with a surname', () => {
    expect(q('Arkadi & Boris Strugazki - Die bewohnte Insel (1969)', ['Arkadi', 'Boris Strugazki'])).toMatchObject({
      title: 'Die bewohnte Insel',
      author: 'Boris Strugazki',
    });
  });

  it('keeps a title that has a dash of its own', () => {
    expect(q('Onnen Visser - Der Schmugglersohn von Norderney', ['Sophie Wörishöffer'])?.title).toBe('Onnen Visser - Der Schmugglersohn von Norderney');
  });

  it('drops notes in brackets and the subtitle', () => {
    expect(q('The Causal Angel (Jean le Flambeur)', ['Hannu Rajaniemi'])?.title).toBe('The Causal Angel');
    expect(q('We Are Legion (We Are Bob) (Bobiverse Book 1)', ['Dennis E. Taylor'])?.title).toBe('We Are Legion');
    expect(q('Wool Omnibus Edition (Wool 1 - 5)', ['Howey, Hugh'])?.title).toBe('Wool Omnibus Edition');
    expect(q('State of Fear: A Novel', ['Michael Crichton'])?.title).toBe('State of Fear');
    expect(q('"Who he?"', ['Alfred Bester'])?.title).toBe('Who he?');
  });

  it('reads a shadow library file name', () => {
    expect(q('Stabilizing an Unstable Economy by Hyman Minsky (z-lib.org)', ['Unknown'])).toMatchObject({ title: 'Stabilizing an Unstable Economy', author: 'Hyman Minsky' });
    // The author field held the converter's name.
    expect(q('Antifragile Things That Gain from Disorder by Nassim Nicholas Taleb (z-lib.org)', ['Zamzar'])?.author).toBe('Nassim Nicholas Taleb');
    expect(q('[John A Peacock] Cosmological physics(BookZZ.org)', ['John A. Peacock'])).toMatchObject({ title: 'Cosmological physics', author: 'John A. Peacock' });
    expect(
      q('The Evolution of Cooperation Revised Edition -- Robert M Axelrod; W D Hamilton -- 1, 1985 -- Basic Books HarperCollins -- isbn13 9780465005642 -- fea940e2 -- Anna’s Archive', ['Unknown']),
    ).toEqual({ title: 'The Evolution of Cooperation', author: 'Robert M Axelrod', isbns: ['9780465005642'] });
  });

  it('skips what is not a book with an author', () => {
    expect(q('README', ['Unknown'])).toBeNull();
    expect(q('1008.1066', ['Unknown'])).toBeNull();
    expect(q('()', ['()'])).toBeNull();
    expect(q('Quick Start Guide', [])).toBeNull();
  });
});
