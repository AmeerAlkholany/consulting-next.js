export interface EmailTemplateData {
  subject: string;
  headline: string;
  body: string;
  actionText?: string;
  actionUrl?: string;
}

export function getAppointmentRequestedTemplate(data: {
  consultantName: string;
  clientName: string;
  startsAtFormatted: string;
  appointmentId: string;
}): EmailTemplateData {
  return {
    subject: `New booking request from ${data.clientName}`,
    headline: "You have a new consultation request",
    body: `${data.clientName} has requested an appointment scheduled for ${data.startsAtFormatted}. Please review and confirm or decline the request.`,
    actionText: "Review Appointment",
    actionUrl: `/consultant/appointments/${data.appointmentId}`,
  };
}

export function getAppointmentConfirmedTemplate(data: {
  clientName: string;
  consultantName: string;
  startsAtFormatted: string;
  appointmentId: string;
}): EmailTemplateData {
  return {
    subject: `Booking confirmed with ${data.consultantName}`,
    headline: "Your consultation has been confirmed",
    body: `Dr. ${data.consultantName} has confirmed your consultation for ${data.startsAtFormatted}.`,
    actionText: "View Details",
    actionUrl: `/appointments/${data.appointmentId}`,
  };
}

export function getAppointmentCancelledTemplate(data: {
  recipientName: string;
  cancelledByName: string;
  reason: string;
  appointmentId: string;
}): EmailTemplateData {
  return {
    subject: "Consultation appointment cancelled",
    headline: "An appointment has been cancelled",
    body: `Your consultation has been cancelled by ${data.cancelledByName}. Reason: ${data.reason}`,
    actionText: "View Schedule",
    actionUrl: "/appointments",
  };
}

export function getAppointmentCompletedTemplate(data: {
  clientName: string;
  consultantName: string;
  appointmentId: string;
}): EmailTemplateData {
  return {
    subject: `Your session with ${data.consultantName} is complete`,
    headline: "Consultation completed",
    body: `Your consultation with ${data.consultantName} has concluded. We hope the session was helpful! Please consider leaving a review.`,
    actionText: "Leave a Review",
    actionUrl: `/appointments/${data.appointmentId}/review`,
  };
}

export function getConsultantApprovedTemplate(data: { consultantName: string }): EmailTemplateData {
  return {
    subject: "Your consultant profile has been approved!",
    headline: "Welcome to our practice platform",
    body: `Congratulations ${data.consultantName}, your qualifications have been verified. Your public profile is now discoverable and ready to accept bookings.`,
    actionText: "Set Availability",
    actionUrl: "/consultant/availability",
  };
}

export function getConsultantRejectedTemplate(data: {
  consultantName: string;
  reason: string;
}): EmailTemplateData {
  return {
    subject: "Consultant verification update",
    headline: "Application Status Update",
    body: `Thank you for applying. We are unable to approve your consultant application at this time. Feedback from our verification team: ${data.reason}`,
    actionText: "Update Profile",
    actionUrl: "/consultant/profile",
  };
}

export function getConsultantSuspendedTemplate(data: {
  consultantName: string;
  reason: string;
}): EmailTemplateData {
  return {
    subject: "Notice regarding your consultant account status",
    headline: "Account Status Notification",
    body: `Your consultant verification status has been suspended. Reason: ${data.reason}`,
    actionText: "Contact Support",
    actionUrl: "/contact",
  };
}

export function getReviewReceivedTemplate(data: {
  consultantName: string;
  rating: number;
}): EmailTemplateData {
  return {
    subject: `You received a new ${data.rating}-star review`,
    headline: "New review received",
    body: `A client has submitted a ${data.rating}-star review for your consultation session.`,
    actionText: "View Reviews",
    actionUrl: "/consultant/reviews",
  };
}

export function getAppointmentReminderTemplate(data: {
  recipientName: string;
  otherPartyName: string;
  startsAtFormatted: string;
  appointmentId: string;
  timeframeText: string;
}): EmailTemplateData {
  return {
    subject: `Reminder: Consultation with ${data.otherPartyName} ${data.timeframeText}`,
    headline: "Upcoming Consultation Reminder",
    body: `This is a reminder that your consultation appointment with ${data.otherPartyName} is scheduled for ${data.startsAtFormatted} (${data.timeframeText}).`,
    actionText: "View Appointment",
    actionUrl: `/appointments/${data.appointmentId}`,
  };
}
