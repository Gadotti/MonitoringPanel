const viewSelector = document.getElementById('view-selector');
const modal = document.getElementById('settings-modal');
const inputTitle = document.getElementById('card-title');
const inputColumns = document.getElementById('columns');
const inputRows = document.getElementById('rows');
const btnApply = document.getElementById('btn-apply');
const grid = document.querySelector('.grid');

const addCardBtn = document.getElementById('btn-new-card');
const addCardModal = document.getElementById('add-card-modal');
const closeAddCardModal = document.getElementById('close-add-card-modal');
const confirmAddCardsBtn = document.getElementById('confirm-add-cards');
const cardSelectionList = document.getElementById('card-selection-list');

const btnRemove = document.getElementById('btn-remove');

let availableCards = [];
let currentCard = null;
let resizing = null;
let draggedItem = null;
let selectedView = null;
