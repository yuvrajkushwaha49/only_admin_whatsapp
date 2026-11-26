/**
 * Predefined Starter Templates for WhatsApp Automation Builder
 * Matching Phase 3 Requirements:
 * 1. Blank
 * 2. Product Enquiry
 * 3. Product Catalogue + Call Back
 * 4. Lead Qualification
 * 5. Feedback Survey
 * 6. Support Menu
 */

export const PREDEFINED_TEMPLATES = {
  blank: {
    id: 'blank',
    name: 'Blank',
    badge: 'Custom',
    description: 'One welcome message; build the rest yourself.',
    icon: 'bi-file-earmark-plus',
    initialDefinition: {
      triggers: {
        keywords: ['hi', 'hello', 'start'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Welcome Message',
          messageType: 'text',
          isFirst: true,
          content: 'Hello {{name}}! Welcome to our WhatsApp service. How can we assist you today?',
          buttons: [
            { id: 'btn_1', text: 'Learn More', action: 'next_step', targetStepId: null },
            { id: 'btn_2', text: 'Talk to Human', action: 'human_handover', targetStepId: null }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: false,
        preQuestionLine: 'I did not quite understand that.',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Thank you! Our team will call you shortly.',
        messageAfterNo: 'No problem. Let us continue.',
        unexpectedReplyLimit: 2,
        handoverMessage: 'I am connecting you with one of our team members right now. Please wait a moment.',
        assignAgentId: null
      }
    }
  },

  product_enquiry: {
    id: 'product_enquiry',
    name: 'Product Enquiry',
    badge: 'Popular',
    description: 'Ask what the customer is interested in, explain the product, and offer a callback.',
    icon: 'bi-box-seam',
    initialDefinition: {
      triggers: {
        keywords: ['product', 'price', 'pricing', 'details', 'catalogue'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Category Selection',
          messageType: 'interactive_buttons',
          isFirst: true,
          content: 'Hello {{name}}! 👋 Thank you for reaching out. Which of our product categories are you interested in today?',
          buttons: [
            { id: 'btn_cat_1', text: 'Enterprise Plans', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_cat_2', text: 'Standard Plans', action: 'go_to_step', targetStepId: 'step_3' },
            { id: 'btn_cat_3', text: 'Request Call', action: 'request_callback', targetStepId: null }
          ]
        },
        {
          id: 'step_2',
          name: 'Enterprise Features',
          messageType: 'text',
          isFirst: false,
          content: '🚀 *Enterprise Solution Highlights:*\n- Unlimited WhatsApp Broadcast Campaigns\n- Multi-Agent Team Inbox\n- Dedicated Account Manager & SLA\n- Custom Webhook Integrations\n\nWould you like our enterprise specialist to call you?',
          buttons: [
            { id: 'btn_ent_yes', text: 'Yes, Call Me', action: 'request_callback', targetStepId: null },
            { id: 'btn_ent_faq', text: 'Support Options', action: 'go_to_step', targetStepId: 'step_4' }
          ]
        },
        {
          id: 'step_3',
          name: 'Standard Features',
          messageType: 'text',
          isFirst: false,
          content: '✨ *Standard Plan Highlights:*\n- Up to 10,000 Messages/day\n- Ready-to-use Automated Templates\n- CSV Contact Importer\n- Real-Time Analytics\n\nShall we arrange a quick demo call for you?',
          buttons: [
            { id: 'btn_std_yes', text: 'Book Demo Call', action: 'request_callback', targetStepId: null },
            { id: 'btn_std_end', text: 'Got It, Thanks', action: 'end_conversation', targetStepId: null }
          ]
        },
        {
          id: 'step_4',
          name: 'Support Options',
          messageType: 'text',
          isFirst: false,
          content: 'Our support team is available 9 AM to 7 PM IST Monday to Saturday. Would you like to chat with an agent directly?',
          buttons: [
            { id: 'btn_chat_agent', text: 'Chat with Agent', action: 'human_handover', targetStepId: null },
            { id: 'btn_main_menu', text: 'Main Menu', action: 'go_to_step', targetStepId: 'step_1' }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: true,
        preQuestionLine: 'We noticed you sent a custom message.',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Thank you! Our product advisor will give you a call shortly.',
        messageAfterNo: 'No problem. Feel free to type "menu" anytime to restart.',
        unexpectedReplyLimit: 2,
        handoverMessage: 'Transferring your chat to a live advisor. One moment please!',
        assignAgentId: null
      }
    }
  },

  catalogue_callback: {
    id: 'catalogue_callback',
    name: 'Product Catalogue + Call Back',
    badge: 'Sales',
    description: 'Show products from Product Library, allow customers to explore products, and request callbacks.',
    icon: 'bi-grid-3x3-gap',
    initialDefinition: {
      triggers: {
        keywords: ['catalog', 'catalogue', 'brochure', 'items'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Catalogue Overview',
          messageType: 'text',
          isFirst: true,
          content: 'Welcome {{name}}! 🛍️ Here is our latest product catalogue.\n\nBrowse through our best-selling categories below or request a callback with pricing details.',
          buttons: [
            { id: 'btn_view_cat', text: 'View Top Sellers', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_req_quote', text: 'Get Price Quote', action: 'request_callback', targetStepId: null }
          ]
        },
        {
          id: 'step_2',
          name: 'Top Sellers List',
          messageType: 'text',
          isFirst: false,
          content: '📦 *Top Selling Solutions:*\n1. WhatsApp Bulk Campaigner\n2. AI Chatbot Assistant\n3. Cloud API Multi-Number Connector\n\nWould you like a representative to call you with discounted quotation?',
          buttons: [
            { id: 'btn_deal_call', text: 'Request Callback', action: 'request_callback', targetStepId: null },
            { id: 'btn_deal_agent', text: 'Speak to Sales', action: 'human_handover', targetStepId: null }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: true,
        preQuestionLine: 'Need help choosing the right product?',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Thank you! Our sales team will call you within 15 minutes.',
        messageAfterNo: 'Understood. Enjoy exploring our catalogue!',
        unexpectedReplyLimit: 2,
        handoverMessage: 'Connecting you to our sales desk. Please hold.',
        assignAgentId: null
      }
    }
  },

  lead_qualification: {
    id: 'lead_qualification',
    name: 'Lead Qualification',
    badge: 'Conversion',
    description: 'Collect customer name, city, and requirement, create a lead and pass it to the team.',
    icon: 'bi-funnel',
    initialDefinition: {
      triggers: {
        keywords: ['join', 'register', 'apply', 'quote', 'requirement'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Welcome & Intent',
          messageType: 'text',
          isFirst: true,
          content: 'Hello {{name}}! 🎯 We would love to tailor our solution for your business.\n\nCould you select your primary business requirement?',
          buttons: [
            { id: 'btn_req_mkt', text: 'WhatsApp Marketing', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_req_api', text: 'API Integration', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_req_sup', text: 'Support Automation', action: 'go_to_step', targetStepId: 'step_2' }
          ]
        },
        {
          id: 'step_2',
          name: 'Collect City & Details',
          messageType: 'text',
          isFirst: false,
          content: 'Great choice! Please reply with your *City* or *Location* so we can assign your nearest regional account manager.',
          buttons: [
            { id: 'btn_skip_city', text: 'Share Later', action: 'go_to_step', targetStepId: 'step_3' }
          ]
        },
        {
          id: 'step_3',
          name: 'Lead Captured Confirmation',
          messageType: 'text',
          isFirst: false,
          content: 'Thank you! Your information has been registered. An executive has been assigned to your account and will get in touch shortly.',
          buttons: [
            { id: 'btn_urgent_call', text: 'Call Me Urgently', action: 'request_callback', targetStepId: null },
            { id: 'btn_finish', text: 'All Done', action: 'end_conversation', targetStepId: null }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: false,
        preQuestionLine: 'Would you like us to call you directly?',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Confirmed! We have marked this as high priority for callback.',
        messageAfterNo: 'No problem. We will continue.',
        unexpectedReplyLimit: 2,
        handoverMessage: 'Handing your profile over to our senior lead consultant now.',
        assignAgentId: null
      }
    }
  },

  feedback_survey: {
    id: 'feedback_survey',
    name: 'Feedback Survey',
    badge: 'Customer Care',
    description: 'Ask customers for ratings and offer callbacks for unhappy customers.',
    icon: 'bi-star',
    initialDefinition: {
      triggers: {
        keywords: ['feedback', 'review', 'rating', 'rate', 'survey'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Rating Question',
          messageType: 'interactive_buttons',
          isFirst: true,
          content: 'Hi {{name}}, how would you rate your recent experience with our service?',
          buttons: [
            { id: 'btn_rate_good', text: '⭐⭐⭐⭐⭐ Excellent', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_rate_ok', text: '⭐⭐⭐ Average', action: 'go_to_step', targetStepId: 'step_3' },
            { id: 'btn_rate_poor', text: '⭐ Poor', action: 'go_to_step', targetStepId: 'step_3' }
          ]
        },
        {
          id: 'step_2',
          name: 'Thank You Message',
          messageType: 'text',
          isFirst: false,
          content: 'Thank you so much for the glowing review! We are thrilled to serve you. Have a fantastic day! 🌟',
          buttons: [
            { id: 'btn_done', text: 'Finish', action: 'end_conversation', targetStepId: null }
          ]
        },
        {
          id: 'step_3',
          name: 'Unhappy Followup & Callback',
          messageType: 'text',
          isFirst: false,
          content: 'We sincerely apologize that your experience did not meet expectations. We would love to resolve this for you immediately.',
          buttons: [
            { id: 'btn_fb_callback', text: 'Yes, call me', action: 'request_callback', targetStepId: null },
            { id: 'btn_fb_human', text: 'Chat with Supervisor', action: 'human_handover', targetStepId: null }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: false,
        preQuestionLine: 'Would you like a team member to follow up on your feedback?',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Thank you! A senior manager will contact you.',
        messageAfterNo: 'Thank you for your valuable feedback.',
        unexpectedReplyLimit: 2,
        handoverMessage: 'Connecting you with our customer resolution team.',
        assignAgentId: null
      }
    }
  },

  support_menu: {
    id: 'support_menu',
    name: 'Support Menu',
    badge: 'Assistance',
    description: 'Provide opening hours, location, contact information and human support options.',
    icon: 'bi-headset',
    initialDefinition: {
      triggers: {
        keywords: ['help', 'support', 'menu', 'contact', 'hours', 'address'],
        buttonId: null
      },
      steps: [
        {
          id: 'step_1',
          name: 'Main Support Menu',
          messageType: 'interactive_buttons',
          isFirst: true,
          content: 'Hello {{name}}! Welcome to Customer Support. How can we help you right now?',
          buttons: [
            { id: 'btn_sup_hours', text: 'Working Hours', action: 'go_to_step', targetStepId: 'step_2' },
            { id: 'btn_sup_loc', text: 'Our Office', action: 'go_to_step', targetStepId: 'step_3' },
            { id: 'btn_sup_human', text: 'Human Support', action: 'human_handover', targetStepId: null }
          ]
        },
        {
          id: 'step_2',
          name: 'Working Hours Info',
          messageType: 'text',
          isFirst: false,
          content: '⏰ *Operating Hours:*\nMonday – Friday: 9:00 AM – 8:00 PM IST\nSaturday: 10:00 AM – 5:00 PM IST\nSunday: Emergency WhatsApp Support Only',
          buttons: [
            { id: 'btn_back_menu_1', text: 'Back to Menu', action: 'go_to_step', targetStepId: 'step_1' },
            { id: 'btn_call_me_1', text: 'Request Callback', action: 'request_callback', targetStepId: null }
          ]
        },
        {
          id: 'step_3',
          name: 'Location & Contact',
          messageType: 'text',
          isFirst: false,
          content: '📍 *Office Headquarters:*\nDrt Lifesciences & Technology Park\nSupport Email: support@aiveexa.com\nEmergency Helpline: +1 555-783-6922',
          buttons: [
            { id: 'btn_back_menu_2', text: 'Back to Menu', action: 'go_to_step', targetStepId: 'step_1' },
            { id: 'btn_chat_human_2', text: 'Talk to Agent', action: 'human_handover', targetStepId: null }
          ]
        }
      ],
      fallback: {
        askCallbackOnUnexpected: true,
        askAfterLastMessage: true,
        preQuestionLine: 'Could not find what you were looking for?',
        question: 'Call back needed?',
        yesButtonText: 'Yes, call me',
        noButtonText: 'No, thanks',
        messageAfterYes: 'Understood. A support specialist will call you promptly.',
        messageAfterNo: 'No problem. You can type "help" at any time.',
        unexpectedReplyLimit: 2,
        handoverMessage: 'Connecting your session to an available support specialist...',
        assignAgentId: null
      }
    }
  }
};

export function getTemplateById(templateId = 'blank') {
  return PREDEFINED_TEMPLATES[templateId] || PREDEFINED_TEMPLATES.blank;
}
