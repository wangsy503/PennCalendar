console.log('Content script loaded');
if (window.contentScriptInjected !== true) {
  window.contentScriptInjected = true; // Prevent script from being injected multiple times

  function extractCourseInformation(resultElement) {
    const codeElement = resultElement.querySelector('.result__code');
    const titleElement = resultElement.querySelector('.result__title');
    const meetTimeElement = resultElement.querySelector('.result__part > .flex--grow');
    
    const courseCode = codeElement.textContent.trim();
    const courseTitle = titleElement.textContent.trim();
    const meetTime = meetTimeElement.textContent.replace('Meets:', '').trim();
    
    return { courseCode, courseTitle, meetTime };
  }
  // listen for messages from background script
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (message.action === 'contentScriptStartExtraction') {
      console.log('Starting extraction...');
    
    // Find all result elements and extract course information from each
    let resultElements = document.querySelectorAll('.result--group-start');
    let extractedCourses = [];
  
    resultElements.forEach(resultElement => {
      let courseInfo = extractCourseInformation(resultElement);
      extractedCourses.push(courseInfo);
    });
    
    // Send the extracted course information to the background script for further processing
    chrome.runtime.sendMessage({ action: 'sendExtractedData', courses: extractedCourses });
    }


  });
}
