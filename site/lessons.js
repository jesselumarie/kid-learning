export const LESSONS = [
  {
    id: 'first-patch', chapter: 0, title: 'Count the squares',
    story: 'Each square is 1 cm wide and 1 cm tall. Count the squares that cover the rectangle.',
    tip: 'Put the ruler’s 0 at a corner. Measure across, then turn it to measure down. Count spaces, not tick marks.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [4, 0], [4, 3], [0, 3]],
    splits: [{ id: 'whole', label: 'One rectangle', lines: [], rects: [{ x: 0, y: 0, w: 4, h: 3 }] }],
    reason: {
      question: 'What does the area tell us?',
      choices: [
        { text: 'How far it is around the edge.', correct: false, feedback: 'The distance around the edge is called perimeter. Look at the squares inside.' },
        { text: 'How many unit squares cover the inside.', correct: true, feedback: 'Area counts the unit squares that cover the inside, without gaps or overlaps.' },
        { text: 'How long just one side is.', correct: false, feedback: 'One side gives a length. Area uses both width and height to cover the inside.' },
      ],
    },
  },
  {
    id: 'rows-of-flowers', chapter: 0, title: 'Use equal rows',
    story: 'Find the number of squares in each row. Then find the number of rows.',
    tip: 'Width tells how many squares fit in a row. Height tells how many rows there are.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [5, 0], [5, 3], [0, 3]],
    splits: [{ id: 'whole', label: 'One rectangle', lines: [], rects: [{ x: 0, y: 0, w: 5, h: 3 }] }],
    reason: {
      question: 'Why does width × height find the area?',
      choices: [
        { text: 'It counts an equal number of squares in every row.', correct: true, feedback: 'Equal rows make multiplication a shortcut for counting all the squares.' },
        { text: 'It adds the lengths of two edges.', correct: false, feedback: 'Adding two edges leaves most of the inside uncounted. Think of all the equal rows.' },
        { text: 'It counts only the squares along the outside.', correct: false, feedback: 'Area includes the middle squares too. Each row stretches all the way across.' },
      ],
    },
  },
  {
    id: 'room-to-grow', chapter: 0, title: 'Square feet',
    story: 'Measure this rectangle in feet. Each grid square covers one square foot.',
    tip: 'Lengths use feet. An area uses square feet because it counts squares that are 1 foot by 1 foot.',
    unit: 'ft', grid: true, independent: false,
    polygon: [[0, 0], [6, 0], [6, 4], [0, 4]],
    splits: [{ id: 'whole', label: 'One rectangle', lines: [], rects: [{ x: 0, y: 0, w: 6, h: 4 }] }],
    reason: {
      question: 'What does one square foot mean?',
      choices: [
        { text: 'A line that is one foot long.', correct: false, feedback: 'A line measures length. A square foot covers part of a surface.' },
        { text: 'Any shape with four sides.', correct: false, feedback: 'The size matters too. A square foot has a specific width and height.' },
        { text: 'A square that is 1 foot wide and 1 foot tall.', correct: true, feedback: 'Each of those squares covers one square foot of the garden.' },
      ],
    },
  },
  {
    id: 'around-the-corner', chapter: 1, title: 'Split an L-shape',
    story: 'Split this shape into two rectangles. Measure their sides and find each area.',
    tip: 'A useful split makes rectangles. The parts should meet at the cut, with no gaps and no overlaps.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [4, 0], [4, 2], [6, 2], [6, 5], [0, 5]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[4, 2], [4, 5]]], rects: [{ x: 0, y: 0, w: 4, h: 5 }, { x: 4, y: 2, w: 2, h: 3 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[0, 2], [4, 2]]], rects: [{ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 2, w: 6, h: 3 }] },
    ],
    reason: {
      question: 'Why can we add the two rectangle areas?',
      choices: [
        { text: 'The rectangles cover the whole shape exactly once.', correct: true, feedback: 'Every square belongs to one rectangle, so adding counts every square once.' },
        { text: 'Adding works even if the rectangles overlap.', correct: false, feedback: 'An overlapping square would be counted twice. The parts must meet without overlapping.' },
        { text: 'We should include the empty corner too.', correct: false, feedback: 'The empty corner is outside the shape. Its squares do not belong in the area.' },
      ],
    },
  },
  {
    id: 'garden-bend', chapter: 1, title: 'Measure each rectangle',
    story: 'Split the garden into two rectangles. Use each rectangle’s own measurements to find its area.',
    tip: 'Measure each colored rectangle’s own width and height. A small part may not use the whole outside length.',
    unit: 'ft', grid: true, independent: false,
    polygon: [[5, 0], [8, 0], [8, 6], [0, 6], [0, 3], [5, 3]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[5, 3], [5, 6]]], rects: [{ x: 0, y: 3, w: 5, h: 3 }, { x: 5, y: 0, w: 3, h: 6 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[5, 3], [8, 3]]], rects: [{ x: 5, y: 0, w: 3, h: 3 }, { x: 0, y: 3, w: 8, h: 3 }] },
    ],
    reason: {
      question: 'A rectangle stops at the split. Which length belongs in its multiplication?',
      choices: [
        { text: 'Always use the longest edge of the whole garden.', correct: false, feedback: 'That could stretch this rectangle into another part. Measure only the rectangle you are finding.' },
        { text: 'Use the width and height of that rectangle.', correct: true, feedback: 'Each part needs its own measurements before you add the part areas.' },
        { text: 'Use the number of corners.', correct: false, feedback: 'Corners do not tell how many squares fit inside. You need the rectangle’s width and height.' },
      ],
    },
  },
  {
    id: 'two-good-plans', chapter: 1, title: 'Two ways to split',
    story: 'Choose a way to split the shape into rectangles. Find their areas and add them.',
    tip: 'Different splits make different rectangles. Both ways still cover the same shape.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [5, 0], [5, 3], [8, 3], [8, 7], [0, 7]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[5, 3], [5, 7]]], rects: [{ x: 0, y: 0, w: 5, h: 7 }, { x: 5, y: 3, w: 3, h: 4 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[0, 3], [5, 3]]], rects: [{ x: 0, y: 0, w: 5, h: 3 }, { x: 0, y: 3, w: 8, h: 4 }] },
    ],
    reason: {
      question: 'If we choose the other correct split, what happens to the total area?',
      choices: [
        { text: 'It gets bigger because one rectangle gets wider.', correct: false, feedback: 'One part changes, but so does the other. No squares were added to the original shape.' },
        { text: 'It gets smaller because the cut moves.', correct: false, feedback: 'A cut changes the parts, but it does not take any squares away.' },
        { text: 'It stays the same because we cover the same squares.', correct: true, feedback: 'The part areas can change while their total stays the same.' },
      ],
    },
  },
  {
    id: 'missing-length', chapter: 2, title: 'Find a missing length',
    story: 'Find the short horizontal side. Then split the shape into rectangles and find the total area.',
    tip: 'The short step and the top edge together reach as far across as the bottom edge.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [6, 0], [6, 2], [9, 2], [9, 6], [0, 6]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[6, 2], [6, 6]]], rects: [{ x: 0, y: 0, w: 6, h: 6 }, { x: 6, y: 2, w: 3, h: 4 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[0, 2], [6, 2]]], rects: [{ x: 0, y: 0, w: 6, h: 2 }, { x: 0, y: 2, w: 9, h: 4 }] },
    ],
    reason: {
      question: 'The bottom is 9 cm across and the top is 6 cm across. How can we find the short step?',
      choices: [
        { text: 'Subtract: 9 − 6.', correct: true, feedback: 'The whole width minus the known part leaves the missing part.' },
        { text: 'Add: 9 + 6.', correct: false, feedback: 'The short step is part of the whole width. Adding would give a length bigger than the whole shape.' },
        { text: 'Multiply: 9 × 6.', correct: false, feedback: 'Multiplication of two lengths can find a rectangle’s area. Here we are finding a missing part of a length.' },
      ],
    },
  },
  {
    id: 'terraced-patch', chapter: 2, title: 'Three rectangles',
    story: 'Split the shape into three rectangles. Find each area, then add all three.',
    tip: 'Find the areas of rectangles A, B, and C. Add each area once, even if two areas are equal.',
    unit: 'cm', grid: true, independent: false,
    polygon: [[0, 0], [3, 0], [3, 2], [6, 2], [6, 4], [9, 4], [9, 7], [0, 7]],
    splits: [
      { id: 'vertical', label: 'Three columns', lines: [[[3, 2], [3, 7]], [[6, 4], [6, 7]]], rects: [{ x: 0, y: 0, w: 3, h: 7 }, { x: 3, y: 2, w: 3, h: 5 }, { x: 6, y: 4, w: 3, h: 3 }] },
      { id: 'horizontal', label: 'Three rows', lines: [[[0, 2], [3, 2]], [[0, 4], [6, 4]]], rects: [{ x: 0, y: 0, w: 3, h: 2 }, { x: 0, y: 2, w: 6, h: 2 }, { x: 0, y: 4, w: 9, h: 3 }] },
    ],
    reason: {
      question: 'What should you do after finding the three rectangle areas?',
      choices: [
        { text: 'Multiply all three areas together.', correct: false, feedback: 'Multiplying the separate areas does not count their squares. We want to combine the three groups of squares.' },
        { text: 'Add all three areas, counting each part once.', correct: true, feedback: 'The three parts together cover the whole shape, so their areas add together.' },
        { text: 'Use only the largest rectangle’s area.', correct: false, feedback: 'That would leave two parts of the shape uncounted. Every rectangle contributes squares.' },
      ],
    },
  },
  {
    id: 'courtyard', chapter: 2, title: 'Leave out the empty space',
    story: 'Find the area of this garden. Do not include the empty space in the middle.',
    tip: 'Check that every rectangle stays inside the garden. No rectangle should cover the empty space.',
    unit: 'ft', grid: true, independent: false,
    polygon: [[0, 0], [3, 0], [3, 3], [7, 3], [7, 0], [10, 0], [10, 7], [0, 7]],
    splits: [
      { id: 'vertical', label: 'Sides and center', lines: [[[3, 3], [3, 7]], [[7, 3], [7, 7]]], rects: [{ x: 0, y: 0, w: 3, h: 7 }, { x: 3, y: 3, w: 4, h: 4 }, { x: 7, y: 0, w: 3, h: 7 }] },
      { id: 'horizontal', label: 'Top and bottom', lines: [[[0, 3], [3, 3]], [[7, 3], [10, 3]]], rects: [{ x: 0, y: 0, w: 3, h: 3 }, { x: 7, y: 0, w: 3, h: 3 }, { x: 0, y: 3, w: 10, h: 4 }] },
    ],
    reason: {
      question: 'Why would multiplying the whole outside width by the whole outside height be too much?',
      choices: [
        { text: 'Multiplication never works for gardens.', correct: false, feedback: 'Multiplication works for each rectangular part. The question is which squares the big outside rectangle includes.' },
        { text: 'The empty courtyard should be counted twice.', correct: false, feedback: 'The courtyard is outside the planted shape. It should not be counted as garden area.' },
        { text: 'That big rectangle includes the empty courtyard.', correct: true, feedback: 'The garden has a missing part. We count only the squares inside the planted shape.' },
      ],
    },
  },
  {
    id: 'designer-challenge', chapter: 3, title: 'Test practice: centimeters',
    story: 'Find the area in square centimeters. Split the shape, measure each rectangle, and add their areas.',
    tip: 'Start each measurement at 0 on the ruler. Turn on the grid if you need help checking a length.',
    unit: 'cm', grid: false, independent: true,
    polygon: [[0, 0], [7, 0], [7, 3], [9, 3], [9, 8], [0, 8]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[7, 3], [7, 8]]], rects: [{ x: 0, y: 0, w: 7, h: 8 }, { x: 7, y: 3, w: 2, h: 5 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[0, 3], [7, 3]]], rects: [{ x: 0, y: 0, w: 7, h: 3 }, { x: 0, y: 3, w: 9, h: 5 }] },
    ],
    reason: {
      question: 'You found the area of each rectangle. What must your final answer include?',
      choices: [
        { text: 'Add the part areas and label the total in square centimeters.', correct: true, feedback: 'Add the rectangle areas and write the total in square centimeters.' },
        { text: 'Stop after writing the two separate areas.', correct: false, feedback: 'Add the two rectangle areas, then write the total with square units.' },
        { text: 'Add the outside edge lengths and write centimeters.', correct: false, feedback: 'That finds perimeter. For area, combine the squares in your rectangles and use square units.' },
      ],
    },
  },
  {
    id: 'garden-designer', chapter: 3, title: 'Test practice: feet',
    story: 'Find the area of this L-shaped garden in square feet. Split it into rectangles and show each calculation.',
    tip: 'Count the corner where the two sides meet only once.',
    unit: 'ft', grid: false, independent: true,
    polygon: [[10, 0], [15, 0], [15, 10], [0, 10], [0, 5], [10, 5]],
    splits: [
      { id: 'vertical', label: 'Cut down', lines: [[[10, 5], [10, 10]]], rects: [{ x: 0, y: 5, w: 10, h: 5 }, { x: 10, y: 0, w: 5, h: 10 }] },
      { id: 'horizontal', label: 'Cut across', lines: [[[10, 5], [15, 5]]], rects: [{ x: 10, y: 0, w: 5, h: 5 }, { x: 0, y: 5, w: 15, h: 5 }] },
    ],
    reason: {
      question: 'What goes wrong if you use the full bottom arm and the full tall arm together?',
      choices: [
        { text: 'Nothing: using the full arms always works.', correct: false, feedback: 'Look at the corner where the arms meet. The two full rectangles would both include those same squares.' },
        { text: 'The corner where they meet is counted twice.', correct: true, feedback: 'A correct split gives that corner to one part only, so every square is counted once.' },
        { text: 'We would forget to count the corner.', correct: false, feedback: 'Both full arms include the corner. The trouble is counting it more than once.' },
      ],
    },
  },
  {
    id: 'final-problem', final: true, chapter: 3, title: 'Final problem',
    story: 'Find the area of this shape. Write your own calculations in the scratch pad, then enter your final answer.',
    tip: 'Check that your rectangles cover the shape without gaps or overlaps. Add their areas and include square units.',
    unit: 'ft', grid: false, independent: true,
    polygon: [[4, 0], [8, 0], [8, 3], [12, 3], [12, 8], [0, 8], [0, 3], [4, 3]],
    splits: [
      { id: 'horizontal', label: 'Two rectangles', lines: [[[4, 3], [8, 3]]], rects: [{ x: 4, y: 0, w: 4, h: 3 }, { x: 0, y: 3, w: 12, h: 5 }] },
      { id: 'vertical', label: 'Three rectangles', lines: [[[4, 3], [4, 8]], [[8, 3], [8, 8]]], rects: [{ x: 0, y: 3, w: 4, h: 5 }, { x: 4, y: 0, w: 4, h: 8 }, { x: 8, y: 3, w: 4, h: 5 }] },
    ],
    reason: {
      question: 'Why can you add the rectangle areas?',
      choices: [
        { text: 'I added every length around the outside.', correct: false, feedback: 'That explains perimeter. Explain how your rectangles cover the inside of the shape.' },
        { text: 'I chose the biggest rectangle and ignored the rest.', correct: false, feedback: 'That misses some of the shape. Include every part when you find the total area.' },
        { text: 'My rectangles cover the shape once. I multiplied each width and height, then added the areas.', correct: true, feedback: 'Each rectangle’s width × height gives its area. Adding those areas counts every square in the shape once.' },
      ],
    },
  },
];
