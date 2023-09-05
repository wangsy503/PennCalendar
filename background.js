// ===========
// TODO: 
// 1. script injection should only be triggered after DOM rerendered,
//    otherwise the script will be injected multiple times and cause error
// 
// ===========

console.log('Background script loaded');
// Listen for messages from content scripts or popup scripts
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log('message received:');
    console.log(message);

    if (message.action === 'startExtraction') {
        console.log('Step 1: Injecting the foreground script...');
        chrome.scripting.executeScript({
            target: { tabId: message.tabId },
            files: ["./content.js"]
        }).then(() => {
            console.log("INJECTED THE FOREGROUND SCRIPT.");
        })
        .catch(err => console.log(err));

        console.log('Step 2: Tell the foreground script to start extraction...');
        // send a message to the content script to start extraction
        chrome.tabs.sendMessage(message.tabId, { action: 'contentScriptStartExtraction' });
    }
    else if (message.action === 'sendExtractedData') {
        // Step 3: Handle extracted data from content script

        // Handle extracted data from content script
        console.log('Extracted courses:', message.courses);
        extractedCourseInfoList = message.courses;
        const iCalContent = generateICal(extractedCourseInfoList);

        // Trigger download of iCal file
        downloadICalFile(iCalContent);
        sendResponse({ response: 'Data received successfully' });
    } 
    
    // Ensure that sendResponse is called asynchronously
    return true;
  });


function formatTime(date) {
    return date.toISOString().replace(/[-:]/g, '').replace('.', '').substr(0, 15) + 'Z';;
}

function convertTo24Hour(timeString, isPM) {
    const time = timeString.split(':');
    const hours = time[0];
    
    console.log("time.length: ");
    console.log(time.length);
    const minutes = time.length > 1 ? time[1] : '00';
    console.log("hours: ");
    console.log(hours);
    console.log("minutes: ");
    console.log(minutes);
    if (isPM){
      if (parseInt(hours) != 12){
        return (parseInt(hours) + 12) * 60 + parseInt(minutes);
      }
    }
    return parseInt(hours) * 60 + parseInt(minutes);
}


// semesterStartDate: a string in the format of '(m)m/dd', e.g. '8/29'
function extractICalMeetTime(meetTimeString, semesterStartDate, currSemesterYear) {
    const [, timeRange] = meetTimeString.split(' ');
    let [startTime, endTime] = timeRange.split('-');

    // We need to handle the tailing 'a' for AM and 'p' for PM
    const isPM = endTime.endsWith('p'); // otherwise it's AM
    endTime = endTime.replace('a', '').replace('p', '');

    console.log("startTime origin: ");
    console.log(startTime);
    console.log("endTime origin: ");
    console.log(endTime);

    startTimeInMinutes = convertTo24Hour(startTime, isPM);
    endTimeInMinutes = convertTo24Hour(endTime, isPM);
    
    console.log("startTimeInMinutes: ");
    console.log(startTimeInMinutes);
    console.log("endTimeInMinutes: ");
    console.log(endTimeInMinutes);
    
    const startDateTime = new Date(`${currSemesterYear}/${semesterStartDate} ${Math.floor(startTimeInMinutes / 60)}:${startTimeInMinutes % 60}:00`);
    const endDateTime = new Date(`${currSemesterYear}/${semesterStartDate} ${Math.floor(endTimeInMinutes / 60)}:${endTimeInMinutes % 60}:00`);
    return {startTime: startDateTime, endTime: endDateTime};
}

  function extractMeetDaysString(meetTimeString) {
    const [daysString,] = meetTimeString.split(' ');
    const days = daysString.split('').map(day => {
      switch (day) {
        case 'M':
          return 'MO';
        case 'T':
          return 'TU';
        case 'W':
          return 'WE';
        case 'R':
          return 'TH';
        case 'F':
          return 'FR';
        default:
          return '';
      }
    }).filter(day => day !== '');
    
    return days.join(',');
  }
  


  // Function to generate iCal content from course info
function generateICal(courseInfoList) {
      // Create iCalendar events for each extracted course
      const icalEvents = courseInfoList.map((course, index) => {
        if (course.meetTime === 'TBA' || course.meetTime === 'TBD') {
          return '';
        }

        const startDateTime = extractICalMeetTime(course.meetTime, '8/29', '2023').startTime; // Set the start date and time
        const endDateTime = extractICalMeetTime(course.meetTime, '8/29', '2023').endTime; // Set the end date and time
        console.log("startDateTime: ");
        console.log(startDateTime);
        console.log("endDateTime: ");
        console.log(endDateTime);
        const icalEvent = `
BEGIN:VEVENT
UID:${index}
DTSTAMP:${formatTime(new Date())}
SUMMARY:${course.courseCode + ' ' + course.courseTitle}
DTSTART:${formatTime(startDateTime)}
DTEND:${formatTime(endDateTime)}
RRULE:FREQ=WEEKLY;BYDAY=${extractMeetDaysString(course.meetTime)};UNTIL=20231211T235959Z
END:VEVENT
`;
  
        return icalEvent;
      });
  
      // Construct the complete iCalendar string
      const icalString = `
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
${icalEvents.join('\n')}
END:VCALENDAR
`;

    return icalString;
}
  
  
// Function to trigger download of iCal file
// Credit: https://stackoverflow.com/questions/68137730/typeerror-error-url-createobjecturl-not-a-function
function downloadICalFile(iCalContent) {
    
  // for utf8 bom 
    const data = iCalContent;
    const blob = new Blob([data], { type: "text/calendar;charset=utf-8" });

    // use BlobReader object to read Blob data
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      const blobUrl = `data:${blob.type};base64,${btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))}`;
      chrome.downloads.download({
          url: blobUrl,
          filename: 'courses.ics',
          saveAs: true,
          conflictAction: "uniquify"
      });
    };
    reader.readAsArrayBuffer(blob);
    return true;
}