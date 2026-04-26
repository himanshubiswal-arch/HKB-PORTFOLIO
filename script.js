// JavaScript for Himanshu Biswal's Portfolio

// Initialize Supabase client if Supabase is available on this page
let supabaseClient = null;
if (window.supabase && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener('DOMContentLoaded', function() {
    var contactForm = document.getElementById('contact-form');
    var successMessage = document.getElementById('contact-success');
    var errorMessage = document.getElementById('contact-error');
    var submitButton = document.getElementById('submit-button');
    var submitSpinner = document.getElementById('submit-spinner');
    var menuToggle = document.querySelector('.menu-toggle');
    var siteNav = document.querySelector('.site-nav');

    if (contactForm && successMessage && errorMessage && submitButton && submitSpinner) {
        contactForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (!contactForm.checkValidity()) {
                contactForm.reportValidity();
                return;
            }

            if (!supabaseClient) {
                errorMessage.textContent = 'Supabase is not available. Please reload the page with the Supabase client and config scripts.';
                errorMessage.hidden = false;
                return;
            }

            // Show loading state
            submitButton.disabled = true;
            submitButton.classList.add('loading');
            submitSpinner.hidden = false;
            successMessage.hidden = true;
            errorMessage.hidden = true;

            // Get form data
            const formData = new FormData(contactForm);
            const submission = {
                full_name: formData.get('fullName'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message')
            };

            try {
                // Insert into Supabase
                const { data, error } = await supabaseClient
                    .from('contact_submissions')
                    .insert([submission]);

                if (error) {
                    throw error;
                }

                // Success
                successMessage.hidden = false;
                contactForm.reset();
                contactForm.querySelector('input, select, textarea').focus();
            } catch (error) {
                console.error('Error submitting form:', error);
                errorMessage.textContent = error.message ? 'Error: ' + error.message : 'There was an error submitting your message. Please try again later.';
                errorMessage.hidden = false;
            } finally {
                // Hide loading state
                submitButton.disabled = false;
                submitButton.classList.remove('loading');
                submitSpinner.hidden = true;
            }
        });
    }

    if (menuToggle && siteNav) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.addEventListener('click', function() {
            var isOpen = siteNav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    const submissionsGrid = document.getElementById('submissions-grid');
    const adminStatus = document.getElementById('admin-status');

    if (submissionsGrid && adminStatus) {
        if (!supabaseClient) {
            adminStatus.textContent = 'Supabase client is not configured. Please check the admin page includes the Supabase CDN and config file.';
            return;
        }

        const formatDate = (dateString) => {
            return new Date(dateString).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        };

        const createSubmissionCard = (submission) => {
            const isRead = submission.is_read === true;
            const createdAtText = submission.created_at ? formatDate(submission.created_at) : 'Unknown date';
            const card = document.createElement('article');
            card.className = 'submission-card' + (isRead ? ' read' : '');

            const header = document.createElement('div');
            header.className = 'submission-card-header';
            header.innerHTML = `
                <div>
                    <p class="submission-meta">${createdAtText}</p>
                    <h2 class="submission-subject">${submission.subject || 'No subject'}</h2>
                </div>
                <span class="status-badge ${isRead ? 'read' : 'unread'}">${isRead ? 'Read' : 'Unread'}</span>
            `;

            const details = document.createElement('div');
            details.className = 'submission-details';
            details.innerHTML = `
                <p><strong>Name:</strong> ${submission.full_name || 'Unknown'}</p>
                <p><strong>Email:</strong> <a href="mailto:${submission.email}">${submission.email || 'No email'}</a></p>
                <p><strong>Message:</strong></p>
                <p class="submission-message">${submission.message || 'No message provided.'}</p>
            `;

            const actionRow = document.createElement('div');
            actionRow.className = 'submission-actions';

            const button = document.createElement('button');
            button.className = 'mark-read-button';
            button.type = 'button';
            button.textContent = isRead ? 'Read' : 'Mark as read';
            button.disabled = isRead;

            button.addEventListener('click', async () => {
                button.disabled = true;
                button.textContent = 'Marking...';
                adminStatus.textContent = '';
                try {
                    const { data, error } = await supabaseClient
                        .from('contact_submissions')
                        .update({ is_read: true })
                        .eq('id', submission.id)
                        .select();

                    console.log('Mark as read response:', { data, error });

                    if (error) {
                        throw error;
                    }

                    if (!data || data.length === 0) {
                        throw new Error('Update returned no rows. Check that the UPDATE policy allows anon role updates.');
                    }

                    card.classList.add('read');
                    header.querySelector('.status-badge').textContent = 'Read';
                    header.querySelector('.status-badge').classList.remove('unread');
                    header.querySelector('.status-badge').classList.add('read');
                    button.textContent = 'Read';
                } catch (error) {
                    console.error('Error marking submission as read:', error);
                    adminStatus.textContent = 'Unable to mark submission as read: ' + (error.message || error);
                    button.textContent = 'Retry';
                    button.disabled = false;
                }
            });

            actionRow.appendChild(button);
            card.appendChild(header);
            card.appendChild(details);
            card.appendChild(actionRow);
            return card;
        };

        const loadSubmissions = async () => {
            adminStatus.textContent = 'Loading submissions...';
            submissionsGrid.innerHTML = '';

            try {
                const { data, error } = await supabaseClient
                    .from('contact_submissions')
                    .select('*')
                    .order('created_at', { ascending: false });

                console.log('Supabase response:', { data, error });

                if (error) {
                    throw error;
                }

                if (!data || data.length === 0) {
                    submissionsGrid.innerHTML = '<div class="empty-state">No contact submissions found. If you expect rows here, verify that the table contains records and that the anon key has read access on the `contact_submissions` table.</div>';
                    adminStatus.textContent = 'Query succeeded but returned 0 rows. This usually means the anon role has no SELECT access for the table.';
                } else {
                    data.forEach((submission) => {
                        submissionsGrid.appendChild(createSubmissionCard(submission));
                    });
                    adminStatus.textContent = '';
                }
            } catch (error) {
                console.error('Error fetching contact submissions:', error);
                adminStatus.textContent = 'Unable to load submissions at this time: ' + (error.message || error);
            }
        };

        loadSubmissions();
    }
});