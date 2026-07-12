function M.on_inlayhint(err, result, ctx)
  local bufnr = assert(ctx.bufnr)
  local provider = InlayHint.active[bufnr]
  if not provider then
    return
  end

  local state = provider.client_state[ctx.client_id]
  if not state then
    return
  end

  if err then
    log.error('inlay_hint', err)
    state.active_request = {}
    return
  end

  if util.buf_versions[bufnr] ~= ctx.version or not api.nvim_buf_is_loaded(bufnr) then
    return
  end

  -- ignore stale responses
  if state.active_request.request_id and ctx.request_id ~= state.active_request.request_id then
    return
  end

  -- If there's no error but the result is nil, clear existing hints.
  result = result or {}

  local new_lnum_hints = {} ---@type table<integer, vim.lsp.inlay_hint.LineHints>
  local num_unprocessed = #result
  if num_unprocessed == 0 then
    state.active_request = {}
    state.current_result = {}
    if vim.fn.win_gettype(vim.fn.bufwinid(bufnr)) == '' then
      api.nvim__redraw({ buf = bufnr, valid = true, flush = false })
    end
    return
  end

  local lines = api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local client = assert(vim.lsp.get_client_by_id(ctx.client_id))

  for _, hint in ipairs(result) do
    local lnum = hint.position.line
    local line = lines and lines[lnum + 1] or ''
    hint.position.character =
      vim.str_byteindex(line, client.offset_encoding, hint.position.character, false)
    if not new_lnum_hints[lnum] then
      new_lnum_hints[lnum] = {
        hints = {},
        applied = false,
      }
    end
    table.insert(new_lnum_hints[lnum].hints, hint)
  end

  state.active_request = {}
  state.current_result = {
    hints = new_lnum_hints,
    version = ctx.version,
    namespace_cleared = false,
  }

  if vim.fn.win_gettype(vim.fn.bufwinid(bufnr)) == '' then
    api.nvim__redraw({ buf = bufnr, valid = true, flush = false })
  end
end
