import SociComponent from './soci-component.js'

const icons = {
  create: '<rect x="8" y="11" width="8" height="2" rx="0.5" fill="currentColor"/><rect x="11" y="8" width="2" height="8" rx="0.5" fill="currentColor"/>',
  downvote: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.4 18.8C12.2 19.0667 11.8 19.0667 11.6 18.8L6.59999 12.1333C6.35278 11.8037 6.58797 11.3333 6.99999 11.3333H9.99999V6.33329C9.99999 5.78101 10.4477 5.33329 11 5.33329H13C13.5523 5.33329 14 5.78101 14 6.33329V11.3333H17C17.412 11.3333 17.6472 11.8037 17.4 12.1333L12.4 18.8Z" fill="var(--fill-color)"/><path d="M11.6 18.8L12 18.5L12 18.5L11.6 18.8ZM12.4 18.8L12 18.5L12 18.5L12.4 18.8ZM6.59999 12.1333L6.19999 12.4333L6.19999 12.4333L6.59999 12.1333ZM9.99999 11.3333H10.5V11.8333H9.99999V11.3333ZM14 11.3333V11.8333H13.5V11.3333H14ZM17.4 12.1333L17 11.8333L17 11.8333L17.4 12.1333ZM12 18.5L12 18.5L12.8 19.1C12.4 19.6333 11.6 19.6333 11.2 19.1L12 18.5ZM6.99999 11.8333L12 18.5L11.2 19.1L6.19999 12.4333L6.99999 11.8333ZM6.99999 11.8333L6.99999 11.8333L6.19999 12.4333C5.70557 11.7741 6.17595 10.8333 6.99999 10.8333V11.8333ZM9.99999 11.8333H6.99999V10.8333H9.99999V11.8333ZM10.5 6.33329V11.3333H9.49999V6.33329H10.5ZM11 5.83329C10.7239 5.83329 10.5 6.05715 10.5 6.33329H9.49999C9.49999 5.50486 10.1716 4.83329 11 4.83329V5.83329ZM13 5.83329H11V4.83329H13V5.83329ZM13.5 6.33329C13.5 6.05715 13.2761 5.83329 13 5.83329V4.83329C13.8284 4.83329 14.5 5.50486 14.5 6.33329H13.5ZM13.5 11.3333V6.33329H14.5V11.3333H13.5ZM17 11.8333H14V10.8333H17V11.8333ZM17 11.8333L17 11.8333V10.8333C17.824 10.8333 18.2944 11.7741 17.8 12.4333L17 11.8333ZM12 18.5L17 11.8333L17.8 12.4333L12.8 19.1L12 18.5Z" fill="currentColor"/>',
  error: '<path d="M8.5 8.5L15.5 15.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15.5 8.5L8.5 15.5" stroke="currentColor" stroke-width="2" fill="none"/>',
  info: '<circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" fill="none"/><rect x="11" y="7" height="2" width="2" fill="currentColor"/><rect x="11" y="10" height="7" width="2" fill="currentColor"/>',
  menu: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.5 7C4.5 6.44772 4.94772 6 5.5 6H18.5C19.0523 6 19.5 6.44772 19.5 7C19.5 7.55228 19.0523 8 18.5 8H5.5C4.94772 8 4.5 7.55228 4.5 7ZM4.5 12C4.5 11.4477 4.94772 11 5.5 11H18.5C19.0523 11 19.5 11.4477 19.5 12C19.5 12.5523 19.0523 13 18.5 13H5.5C4.94772 13 4.5 12.5523 4.5 12ZM5.5 16C4.94772 16 4.5 16.4477 4.5 17C4.5 17.5523 4.94772 18 5.5 18H18.5C19.0523 18 19.5 17.5523 19.5 17C19.5 16.4477 19.0523 16 18.5 16H5.5Z" fill="currentColor"/>', 
  remove: '<rect x="8" y="11" width="8" height="2" rx="0.5" fill="currentColor"/>',
  spinner: '<circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" opacity="0.1" fill="none"/><path d="M12 1C6 1 1 6 1 12" stroke="currentColor" stroke-width="2" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path>',
  success: '<circle cx="12" cy="12" r="11" stroke="currentColor" stroke-width="2" fill="none"/><path d="M17.33 8.66998L11 15L7.5 11.5" stroke="currentColor" stroke-width="2" fill="none"/>',
  upvote: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.4 5.53331C12.2 5.26665 11.8 5.26665 11.6 5.53331L6.59999 12.2C6.35278 12.5296 6.58797 13 6.99999 13H9.99999V18C9.99999 18.5523 10.4477 19 11 19H13C13.5523 19 14 18.5523 14 18V13H17C17.412 13 17.6472 12.5296 17.4 12.2L12.4 5.53331Z" fill="var(--fill-color)"/><path d="M11.6 5.53331L12 5.83331L12 5.83331L11.6 5.53331ZM12.4 5.53331L12 5.83331L12 5.83331L12.4 5.53331ZM6.59999 12.2L6.99999 12.5L6.99999 12.5L6.59999 12.2ZM9.99999 13H10.5V12.5H9.99999V13ZM14 13V12.5H13.5V13H14ZM17.4 12.2L17.8 11.9L17.8 11.9L17.4 12.2ZM12 5.83331L12 5.83331L12.8 5.23331C12.4 4.69998 11.6 4.69998 11.2 5.23331L12 5.83331ZM6.99999 12.5L12 5.83331L11.2 5.23331L6.19999 11.9L6.99999 12.5ZM6.99999 12.5L6.99999 12.5L6.19999 11.9C5.70557 12.5592 6.17595 13.5 6.99999 13.5V12.5ZM9.99999 12.5H6.99999V13.5H9.99999V12.5ZM10.5 18V13H9.49999V18H10.5ZM11 18.5C10.7238 18.5 10.5 18.2761 10.5 18H9.49999C9.49999 18.8284 10.1716 19.5 11 19.5V18.5ZM13 18.5H11V19.5H13V18.5ZM13.5 18C13.5 18.2761 13.2761 18.5 13 18.5V19.5C13.8284 19.5 14.5 18.8284 14.5 18H13.5ZM13.5 13V18H14.5V13H13.5ZM17 12.5H14V13.5H17V12.5ZM17 12.5L17 12.5V13.5C17.824 13.5 18.2944 12.5592 17.8 11.9L17 12.5ZM12 5.83331L17 12.5L17.8 11.9L12.8 5.23331L12 5.83331Z" fill="currentColor"/>',
  play: '<path d="M8 6.39758V17.6024C8 18.7777 9.29025 19.4964 10.2895 18.8778L19.3396 13.2754C20.2869 12.689 20.2869 11.311 19.3396 10.7246L10.2895 5.12218C9.29024 4.50357 8 5.22231 8 6.39758Z" stroke="currentColor" stroke-width="2" fill="none"/>',
  pause: '<path d="M8 5.5V18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 5.5V18.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fullscreen: '<path d="M8.5 5H6C5.5 5 5 5.5 5 6V8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M15.5 19L18 19C18.5 19 19 18.5 19 18L19 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M19 8.5L19 6C19 5.5 18.5 5 18 5L15.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M5 15.5L5 18C5 18.5 5.5 19 6 19L8.5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  exitfullscreen: '<path d="M5 9L8 9C8.5 9 9 8.5 9 8L9 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M19 15H16C15.5 15 15 15.5 15 16V19" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M15 5L15 8C15 8.5 15.5 9 16 9L19 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M9 19L9 16C9 15.5 8.5 15 8 15L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  volume: '<path d="M11.5 16.6693V7.33072C11.5 5.94568 9.7832 5.30061 8.87114 6.34297L6.54623 9H5C4.17157 9 3.5 9.67157 3.5 10.5V13.5C3.5 14.3284 4.17157 15 5 15H6.54623L8.87113 17.657C9.78319 18.6994 11.5 18.0543 11.5 16.6693Z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M14.5 8.5C16.5 10.5 16.5 13.5 14.5 15.5M17 6C20.5 9 20.5 15 17 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  muted: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.27753 8.10596C3.24906 8.4159 2.5 9.37046 2.5 10.5V13.5C2.5 14.8807 3.61929 16 5 16H6.09246L8.11856 18.3155C9.63866 20.0528 12.5 18.9777 12.5 16.6693V16.3284L10.5 14.3284V14.9628V15.2491V16.2318V16.6693C10.5 17.1309 9.92773 17.346 9.62371 16.9985L9.33562 16.6693L8.68856 15.9298L8.5 15.7143L7 14H6H5C4.72386 14 4.5 13.7761 4.5 13.5V10.5C4.5 10.2238 4.72386 9.99998 5 9.99998H6H6.17155L4.27753 8.10596ZM10.5 8.67157V7.7682V7.3307C10.5 6.86902 9.92773 6.654 9.62371 7.00145L9.33562 7.3307L9.25326 7.42483L7.8359 6.00748L8.11856 5.68444C9.63867 3.94717 12.5 5.02231 12.5 7.3307V10.6716L10.5 8.67157ZM16.394 14.5655L14.8548 13.0264C15.2307 11.7182 14.8767 10.2909 13.7929 9.20709C13.4024 8.81656 13.4024 8.1834 13.7929 7.79287C14.1834 7.40235 14.8166 7.40235 15.2071 7.79287C17.0973 9.68305 17.4929 12.3501 16.394 14.5655ZM19.0424 17.214L17.5972 15.7687C19.302 12.9803 18.886 8.93364 16.3492 6.75924C15.9299 6.39981 15.8813 5.76851 16.2407 5.34919C16.6002 4.92986 17.2315 4.8813 17.6508 5.24072C21.08 8.18002 21.5438 13.6028 19.0424 17.214Z" fill="currentColor"/><path d="M4 5L18 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  warning: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.89476 20C2.93896 20 1.74057 17.8554 2.76561 16.1897L9.87083 4.64374C10.847 3.05739 13.1529 3.05739 14.1291 4.64374L21.2343 16.1897L19.531 17.2379L19.1052 16.5459L18.7891 16.0323L18.7692 16L13.1742 6.908L13.1673 6.89681L12.9449 6.53548L12.4258 5.69193C12.2306 5.37466 11.7694 5.37466 11.5741 5.69193L11.055 6.53548L10.8327 6.89681L10.8258 6.908L5.23074 16L5.21082 16.0323L4.89476 16.5459L4.46893 17.2379C4.26392 17.571 4.50359 18 4.89476 18H5.70725H6.31033H6.34833L17.6516 18H17.6896H18.2927H19.1052C19.4964 18 19.736 17.571 19.531 17.2379L21.2343 16.1897C22.2594 17.8554 21.061 20 19.1052 20H4.89476ZM12 14.5C12.5523 14.5 13 14.9477 13 15.5V16C13 16.5522 12.5523 17 12 17C11.4477 17 11 16.5522 11 16V15.5C11 14.9477 11.4477 14.5 12 14.5ZM13 8.99996C13 8.44767 12.5523 7.99996 12 7.99996C11.4477 7.99996 11 8.44767 11 8.99996V12.5C11 13.0522 11.4477 13.5 12 13.5C12.5523 13.5 13 13.0522 13 12.5V8.99996Z" fill="currentColor"/>'

  // Feed / header icons (16x16 viewBox)
  ,allPosts: { viewBox: '0 0 16 16', body: '<path d="M12 2C13.6569 2 15 3.34315 15 5V8C15 9.60511 13.7394 10.9158 12.1543 10.9961L12 11V10C13.1046 10 14 9.10457 14 8V5C14 3.89543 13.1046 3 12 3H7C5.89543 3 5 3.89543 5 5H4C4 3.34315 5.34315 2 7 2H12Z" fill="currentColor"/><rect x="1.5" y="5.5" width="10" height="8" rx="2.5" stroke="currentColor"/>' }
  ,addPosts: { viewBox: '0 0 16 16', body: '<path d="M11 3C12.6569 3 14 4.34315 14 6V7H13V6C13 4.89543 12.1046 4 11 4H5C3.89543 4 3 4.89543 3 6V10C3 11.1046 3.89543 12 5 12H9V13H5C3.39489 13 2.08421 11.7394 2.00391 10.1543L2 10V6C2 4.34315 3.34315 3 5 3H11Z" fill="currentColor"/><path d="M13 10H15V11H13V13H12V11H10V10H12V8H13V10Z" fill="currentColor"/>' }
  ,comments: { viewBox: '0 0 16 16', body: '<path d="M1.5 9.5V4.5C1.5 3.39543 2.39543 2.5 3.5 2.5H12.5C13.6046 2.5 14.5 3.39543 14.5 4.5V9.5C14.5 10.6046 13.6046 11.5 12.5 11.5H9.81522C9.61005 11.5 9.40984 11.5631 9.24176 11.6808L5.28673 14.4493C4.95534 14.6813 4.5 14.4442 4.5 14.0397V12C4.5 11.7239 4.27614 11.5 4 11.5H3.5C2.39543 11.5 1.5 10.6046 1.5 9.5Z" stroke="currentColor" fill="none"/>' }
  ,cash: { viewBox: '0 0 16 16', body: '<path d="M8 1.5V14.5" stroke="currentColor"/><path d="M11.5 4.5L11.3787 4.37868C10.8161 3.81607 10.053 3.5 9.25736 3.5H6.32843C5.79799 3.5 5.28929 3.71071 4.91421 4.08579C4.13316 4.86684 4.13316 6.13316 4.91421 6.91421C5.28929 7.28929 5.79799 7.5 6.32843 7.5H9.29844C10.0579 7.5 10.7762 7.84522 11.2506 8.43826C11.981 9.35131 11.981 10.6487 11.2506 11.5617C10.7762 12.1548 10.0579 12.5 9.29844 12.5H6.74264C5.94699 12.5 5.18393 12.1839 4.62132 11.6213L4 11" stroke="currentColor"/>' }
  ,emoji: { viewBox: '0 0 16 16', body: '<rect x="1.5" y="1.5" width="13" height="13" rx="6.5" stroke="currentColor"/><path d="M11 8.5C10.7391 9.92223 9.49551 11 8 11C6.50449 11 5.2609 9.92223 5 8.5" stroke="currentColor"/><rect x="6" y="5" width="1" height="2" fill="currentColor"/><rect x="9" y="5" width="1" height="2" fill="currentColor"/>' }
  ,time: { viewBox: '0 0 16 16', body: '<circle cx="8" cy="8" r="5.5" stroke="currentColor" fill="none"/><path d="M7.5 5V8.5H10" stroke="currentColor" stroke-linecap="round" fill="none"/>' }
  ,hash: { viewBox: '0 0 16 16', body: '<g transform="translate(1,1.5)"><path d="M9.28 7.346H11.17V8.62H9.126L8.832 11H7.558L7.852 8.62H5.486L5.192 11H3.918L4.212 8.62H2.322V7.346H4.366L4.688 4.854H2.798V3.58H4.842L5.136 1.2H6.41L6.116 3.58H8.468L8.762 1.2H10.036L9.742 3.58H11.618L11.632 4.854H9.588L9.28 7.346ZM8.006 7.346L8.314 4.854H5.962L5.64 7.346H8.006Z" fill="currentColor"></path></g>' }
  ,viewList: { viewBox: '0 0 16 16', body: '<rect x="0.5" y="1.5" width="15" height="3" rx="1.5" stroke="currentColor"/><rect x="0.5" y="6.5" width="15" height="3" rx="1.5" stroke="currentColor"/><rect x="0.5" y="11.5" width="15" height="3" rx="1.5" stroke="currentColor"/>' }
  ,viewLanes: { viewBox: '0 0 16 16', body: '<rect x="0.5" y="1.5" width="6" height="4" rx="1.5" stroke="currentColor"/><rect x="9.5" y="10.5" width="6" height="4" rx="1.5" stroke="currentColor"/><rect x="9.5" y="1.5" width="6" height="7" rx="1.5" stroke="currentColor"/><rect x="0.5" y="7.5" width="6" height="7" rx="1.5" stroke="currentColor"/>' }
  ,filterImages: { viewBox: '0 0 16 16', body: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-linejoin="round"/><path d="M1.5 9L4.5 7L9.5 10.5L12 9L14.5 11" stroke="currentColor"/><circle cx="11.5" cy="5.5" r="1.5" fill="currentColor"/>' }
  ,filterVideos: { viewBox: '0 0 16 16', body: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-linejoin="round"/><path d="M10.5 8L6 6V10L10.5 8Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' }
  ,filterBlogs: { viewBox: '0 0 16 16', body: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-linejoin="round"/><rect x="3" y="4" width="9" height="1" rx="0.5" fill="currentColor"/><path d="M3 6.5C3 6.22386 3.22386 6 3.5 6H8.5C8.77614 6 9 6.22386 9 6.5C9 6.77614 8.77614 7 8.5 7H3.5C3.22386 7 3 6.77614 3 6.5Z" fill="currentColor"/><rect x="3" y="8" width="7" height="1" rx="0.5" fill="currentColor"/><path d="M3 10.5C3 10.2239 3.22386 10 3.5 10H8.5C8.77614 10 9 10.2239 9 10.5C9 10.7761 8.77614 11 8.5 11H3.5C3.22386 11 3 10.7761 3 10.5Z" fill="currentColor"/>' }
  ,filterLinks: { viewBox: '0 0 16 16', body: '<path d="M5 7H3C2.48232 7 2.05621 7.39333 2.00488 7.89746L2 8V11C2 11.5523 2.44772 12 3 12H8C8.55228 12 9 11.5523 9 11V8C9 7.44772 8.55228 7 8 7V6C9.10457 6 10 6.89543 10 8V11C10 12.0357 9.21278 12.887 8.2041 12.9893L8 13H3L2.7959 12.9893C1.85435 12.8938 1.1062 12.1457 1.01074 11.2041L1 11V8C1 6.89543 1.89543 6 3 6H5V7ZM7 7H6V6H7V7Z" fill="currentColor"/><path d="M13 3C14.1046 3 15 3.89543 15 5V8C15 9.03565 14.2128 9.887 13.2041 9.98926L13 10H11V9H13C13.5523 9 14 8.55228 14 8V5C14 4.44772 13.5523 4 13 4H8C7.48232 4 7.05621 4.39333 7.00488 4.89746L7 5V8C7 8.55228 7.44772 9 8 9V10L7.7959 9.98926C6.85435 9.8938 6.1062 9.14565 6.01074 8.2041L6 8V5C6 3.89543 6.89543 3 8 3H13ZM10 10H9V9H10V10Z" fill="currentColor"/>' }
  ,mail: { viewBox: '0 0 16 16', body: '<rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" fill="none" stroke-linejoin="round"/><path d="M4 3.5H12C12.4307 3.5 12.8189 3.68224 13.0928 3.97461L7.99902 8.34082L2.90527 3.97461C3.13382 3.73056 3.44262 3.56341 3.78906 3.51465L4 3.5Z" stroke="currentColor" fill="none"/>'}
  ,logout: { viewBox: '0 0 16 16', body: '<path d="M1 9.5V6.5C1 4.567 2.567 3 4.5 3H7V4H4.5C3.11929 4 2 5.11929 2 6.5V9.5C2 10.8807 3.11929 12 4.5 12H7V13H4.5C2.567 13 1 11.433 1 9.5Z" fill="currentColor"/><path d="M5.5 8.5V7.5C5.5 6.94772 5.94772 6.5 6.5 6.5H10V5.91421C10 5.02331 11.0771 4.57714 11.7071 5.20711L14.5 8L11.7071 10.7929C11.0771 11.4229 10 10.9767 10 10.0858V9.5H6.5C5.94772 9.5 5.5 9.05228 5.5 8.5Z" stroke="currentColor"/>' }
  ,settings: { viewBox: '0 0 16 16', body: '<path fill-rule="evenodd" clip-rule="evenodd" d="M8 6C9.10457 6 10 6.89543 10 8C10 9.10457 9.10457 10 8 10C6.89543 10 6 9.10457 6 8C6 6.89543 6.89543 6 8 6ZM8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M8.20117 1C9.15976 1 9.9406 1.75012 9.99414 2.69531C10.1106 2.73916 10.2253 2.78677 10.3379 2.83789C10.9988 2.2475 11.9903 2.22903 12.6709 2.78418L12.8076 2.9082L13.0918 3.19238C13.77 3.87062 13.7915 4.95392 13.1602 5.66016C13.2115 5.77315 13.2597 5.88798 13.3037 6.00488C14.2494 6.05791 15 6.83989 15 7.79883V8.20117C15 9.16042 14.2488 9.94157 13.3027 9.99414C13.2588 10.1107 13.2114 10.2253 13.1602 10.3379C13.7923 11.0445 13.7705 12.1289 13.0918 12.8076L12.8076 13.0918C12.1288 13.7706 11.0445 13.7918 10.3379 13.1592C10.2251 13.2104 10.1108 13.2588 9.99414 13.3027C9.9413 14.2488 9.16045 14.9999 8.20117 15H7.79883C6.83953 14.9999 6.0577 14.2488 6.00488 13.3027C5.88838 13.2589 5.77382 13.2113 5.66113 13.1602C4.95491 13.792 3.87079 13.7702 3.19238 13.0918L2.9082 12.8076C2.22987 12.1293 2.20664 11.0446 2.83789 10.3379C2.78677 10.2253 2.73916 10.1106 2.69531 9.99414C1.75012 9.9406 1 9.15976 1 8.20117V7.79883C1 6.84022 1.7501 6.05839 2.69531 6.00488C2.73923 5.88812 2.78665 5.77308 2.83789 5.66016C2.20752 4.95396 2.22968 3.87128 2.90723 3.19336L3.19336 2.90723L3.3291 2.78418C4.00926 2.22916 4.99947 2.24815 5.66016 2.83789C5.77308 2.78665 5.88812 2.73923 6.00488 2.69531C6.05839 1.7501 6.84022 1 7.79883 1H8.20117ZM7.79883 2L7.7168 2.00391C7.31417 2.0448 7 2.38541 7 2.79883L6.98828 2.93652C6.93279 3.25042 6.69172 3.5083 6.38379 3.62207L6.04785 3.76074L5.91699 3.81055C5.60618 3.90493 5.26154 3.8465 5.0293 3.61426C4.71745 3.3028 4.21224 3.3028 3.90039 3.61426L3.61426 3.90039C3.3028 4.21224 3.3028 4.71745 3.61426 5.0293C3.87971 5.29475 3.91789 5.70693 3.76074 6.04785L3.62207 6.38379L3.56445 6.51074C3.41149 6.79728 3.12719 6.99985 2.79883 7C2.35784 7 2 7.35784 2 7.79883V8.20117C2 8.64216 2.35784 9 2.79883 9C3.17394 9.00017 3.4919 9.26438 3.62207 9.61621C3.66407 9.72981 3.71035 9.84194 3.76074 9.95117C3.91793 10.2922 3.87966 10.7041 3.61426 10.9697C3.30244 11.282 3.30314 11.7885 3.61523 12.1006L3.89941 12.3848C4.2114 12.6968 4.71741 12.6968 5.0293 12.3848C5.29465 12.1192 5.70683 12.0813 6.04785 12.2383C6.15714 12.2887 6.26916 12.335 6.38281 12.377C6.73516 12.507 7 12.8256 7 13.2012C7.00011 13.6423 7.3577 13.9999 7.79883 14H8.20117L8.28223 13.9961C8.65865 13.9581 8.95808 13.6586 8.99609 13.2822L9 13.2012C9 12.8256 9.2649 12.5072 9.61719 12.377C9.7304 12.3351 9.84132 12.2885 9.9502 12.2383C10.2914 12.0809 10.704 12.1191 10.9697 12.3848C11.2625 12.6776 11.726 12.6958 12.04 12.4395L12.1006 12.3848L12.3848 12.1006C12.697 11.7883 12.697 11.282 12.3848 10.9697C12.1192 10.7041 12.0817 10.2922 12.2393 9.95117C12.2897 9.84196 12.3358 9.72979 12.3779 9.61621C12.5083 9.26448 12.8261 9.00017 13.2012 9C13.6422 9 14 8.64216 14 8.20117V7.79883C14 7.35784 13.6422 7 13.2012 7C12.8728 6.99985 12.5887 6.7972 12.4355 6.51074L12.3779 6.38379L12.2393 6.04785C12.0818 5.70689 12.1191 5.29475 12.3848 5.0293C12.6968 4.71741 12.6968 4.2114 12.3848 3.89941L12.1006 3.61523C11.7885 3.30314 11.282 3.30244 10.9697 3.61426C10.7373 3.84647 10.3929 3.90498 10.082 3.81055L9.95117 3.76074L9.61621 3.62207C9.26438 3.4919 9.00017 3.17394 9 2.79883C9 2.35784 8.64216 2 8.20117 2H7.79883Z" fill="currentColor"/>' }
}

export default class SociIcon extends SociComponent {
  constructor() {
    super()
  }

  css(){ return `
    :host {
      width: 24px;
      height: 24px;
    }

    svg {
      width: inherit;
      height: inherit;
      display: block;
      fill: none;
    }
  `}

  html(){ return `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"></svg>
  `}

  static get observedAttributes() {
    return ['glyph', 'size']
  }

  set glyph(val){
    this.setAttribute('glyph', val)
  }

  static icon(glyph, size) {
    const { body, viewBox } = SociIcon._resolve(glyph)
    const s = size ? ` width="${size}" height="${size}"` : ''
    return `<svg viewBox="${viewBox}"${s} xmlns="http://www.w3.org/2000/svg">${body}</svg>`
  }

  static _resolve(glyph) {
    const entry = icons[glyph]
    if (!entry) return { body: '', viewBox: '0 0 24 24' }
    if (typeof entry === 'string') return { body: entry, viewBox: '0 0 24 24' }
    return { body: entry.body || '', viewBox: entry.viewBox || '0 0 24 24' }
  }

  attributeChangedCallback(name, oldValue, newValue){
    const svg = this.select('svg')
    if(!svg) return

    if(name === 'size') {
      const s = parseInt(newValue, 10)
      if(s) {
        this.style.width = `${s}px`
        this.style.height = `${s}px`
      } else {
        this.style.width = ''
        this.style.height = ''
      }
      return
    }

    if(name === 'glyph') {
      const { body, viewBox } = SociIcon._resolve(newValue)
      svg.setAttribute('viewBox', viewBox)
      svg.innerHTML = body
    }
  }
}

// Expose globally for fast string rendering in html() calls:
// - SociIcon.icon('hash') or SociIcon('hash')
// - SociIconClass for direct access to the class if needed
if (typeof window !== 'undefined') {
  window.SociIconClass = SociIcon
  window.SociIcon = (glyph, size) => SociIcon.icon(glyph, size)
  window.SociIcon.icon = SociIcon.icon
}
