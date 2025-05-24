document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const sunIcon = document.getElementById('theme-toggle-sun-icon');
    const moonIcon = document.getElementById('theme-toggle-moon-icon');
    const body = document.body;

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            sunIcon.classList.add('d-none');
            moonIcon.classList.remove('d-none');
        } else {
            body.classList.remove('dark-mode');
            sunIcon.classList.remove('d-none');
            moonIcon.classList.add('d-none');
        }
    };

    const toggleTheme = () => {
        const currentThemeIsDark = body.classList.contains('dark-mode');
        const newTheme = currentThemeIsDark ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    // Apply saved theme or default to dark mode
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('dark'); // Default to dark mode
        localStorage.setItem('theme', 'dark'); // Save default to local storage
    }

    // Event listener for the toggle button
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }
});
