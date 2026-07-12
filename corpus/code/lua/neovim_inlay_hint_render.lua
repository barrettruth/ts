function InlayHint:on_win(topline, botline)
  for _, state in pairs(self.client_state) do
    local current_result = state.current_result
    if current_result.version == util.buf_versions[self.bufnr] then
      if not current_result.namespace_cleared then
        api.nvim_buf_clear_namespace(self.bufnr, state.namespace, 0, -1)
        current_result.namespace_cleared = true
      end

      local hints = assert(current_result.hints)

      for lnum = topline, botline do
        local hint_virtual_texts = {} --- @type table<integer, [string, string?][]>
        local line_hints = hints[lnum]
        if line_hints and not line_hints.applied then
          line_hints.applied = true
          for _, hint in pairs(line_hints.hints) do
            local text = ''
            local label = hint.label
            if type(label) == 'string' then
              text = label
            else
              for _, part in ipairs(label) do
                text = text .. part.value
              end
            end
            local vt = hint_virtual_texts[hint.position.character] or {}
            if hint.paddingLeft then
              vt[#vt + 1] = { ' ' }
            end
            vt[#vt + 1] = { text, 'LspInlayHint' }
            if hint.paddingRight then
              vt[#vt + 1] = { ' ' }
            end
            hint_virtual_texts[hint.position.character] = vt
          end
        end

        for pos, vt in pairs(hint_virtual_texts) do
          api.nvim_buf_set_extmark(self.bufnr, state.namespace, lnum, pos, {
            virt_text_pos = 'inline',
            ephemeral = false,
            virt_text = vt,
          })
        end
      end
    end
  end
end
